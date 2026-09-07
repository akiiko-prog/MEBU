import { Multi as EsupMulti } from "esup-multi.js";

import { Auth, Services } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";

import AurigaAPI, { extractSubjectCode } from "../auriga";
import { Syllabus } from "../auriga/types";
import {
  Grade as SharedGrade,
  Period,
  PeriodGrades,
  Subject,
} from "../shared/grade";
import { News } from "../shared/news";
import { CourseDay } from "../shared/timetable";
import { Capabilities, SchoolServicePlugin } from "../shared/types";
import { getCoursesFromCache } from "@/database/useTimetable";
import { fetchMultiNews } from "./news";
import { refreshMultiSession } from "./refresh";
import { fetchMultiTimetable } from "./timetable";

// Fallback exam-type codes; the real set is learned from the syllabuses at runtime.
const DEFAULT_EXAM_TYPES = [
  "EXA", "EXF", "EXP", "EXB", "EXR", "RAT",
  "CC", "CB", "CT", "CONT", "DS", "DM",
  "QCM", "ORAL", "TP", "TPNOTE",
];

// Splits a code like "CN_PC_PSE_EXA_1" into ECUE ("CN_PC_PSE") and exam ("EXA_1").
// Used when no syllabus is available to locate the ECUE boundary.
function splitEcueAndExam(
  fullCode: string,
  knownExamTypes: Set<string>
): { ecueCode: string; examPart: string } {
  const parts = fullCode.split("_");

  // "<TYPE>_<INDEX>" suffix, e.g. "EXA_1"
  if (
    parts.length >= 3 &&
    /^\d+$/.test(parts[parts.length - 1]) &&
    knownExamTypes.has(parts[parts.length - 2])
  ) {
    return {
      ecueCode: parts.slice(0, -2).join("_"),
      examPart: parts.slice(-2).join("_"),
    };
  }

  // "<TYPE>" suffix, e.g. "EXA"
  if (parts.length >= 2 && knownExamTypes.has(parts[parts.length - 1])) {
    return {
      ecueCode: parts.slice(0, -1).join("_"),
      examPart: parts[parts.length - 1],
    };
  }

  // Nothing recognized as an exam suffix — keep the whole code as the ECUE.
  return { ecueCode: fullCode, examPart: "" };
}

export class Multi implements SchoolServicePlugin {
  displayName = "Multi";
  service = Services.MULTI;
  capabilities: Capabilities[] = [
    Capabilities.REFRESH,
    Capabilities.NEWS,
    Capabilities.TIMETABLE,
  ];
  session: EsupMulti | undefined = undefined;
  authData: Auth = {};

  // Track if this is an Auriga account
  isAuriga = false;

  constructor(public accountId: string) { }

  async refreshAccount(credentials: Auth, forceRefresh?: boolean): Promise<Multi> {
    const refresh = await refreshMultiSession(this.accountId, credentials);

    this.authData = refresh.auth;
    this.session = refresh.session;

    if (credentials.additionals?.type === "auriga") {
      this.isAuriga = true;
      this.capabilities = [Capabilities.REFRESH, Capabilities.GRADES, Capabilities.TIMETABLE, Capabilities.SYLLABUS];

      if (credentials.accessToken) {
        AurigaAPI.setToken(credentials.accessToken);
      }
      if (
        credentials.additionals.cookies &&
        typeof credentials.additionals.cookies === "string"
      ) {
        AurigaAPI.setCookie(credentials.additionals.cookies);
      }

      if (forceRefresh) {
        await AurigaAPI.sync();
      }
    }

    return this;
  }

  async getNews(): Promise<News[]> {
    if (this.isAuriga) {
      return [];
    }
    if (this.session) {
      return fetchMultiNews(this.session, this.accountId);
    }
    error("Session is not valid", "Multi.getNews");
    throw new Error("Session is not valid");
  }

  async getWeeklyTimetable(weekNumber: number): Promise<CourseDay[]> {
    if (this.isAuriga) {
      // EDT is synced to DB during AurigaAPI.sync(), serve from cache
      return getCoursesFromCache([weekNumber]);
    }
    if (this.session) {
      return fetchMultiTimetable(this.session, this.accountId, weekNumber);
    }
    error("Session is not valid", "Multi.getWeeklyTimetable");
    throw new Error("Session is not valid");
  }

  // --- Auriga Specific Implementations ---

  async getSyllabus(): Promise<Syllabus[]> {
    if (!this.isAuriga) {
      return [];
    }
    const syllabus = AurigaAPI.getAllSyllabus();
    if (!syllabus || syllabus.length === 0) {
      throw new Error("No syllabus data available from AurigaAPI");
    }
    return syllabus;
  }

  async getGradesPeriods(): Promise<Period[]> {
    if (!this.isAuriga) {
      return [];
    }

    const grades = AurigaAPI.getAllGrades();
    if (!grades || grades.length === 0) {
      throw new Error("No grades data available from AurigaAPI");
    }
    const semesters = Array.from(
      new Set(grades.map(g => g.semester).filter(s => s > 0))
    ).sort((a, b) => b - a);
    const year = new Date().getFullYear();
    return semesters.map(s => ({
      id: `S${s}`,
      name: `Semestre ${s}`,
      start: s / 2 != 0 ? new Date(year, 9, 1) : new Date(year + 1, 1, 1),
      end: s / 2 != 0 ? new Date(year, 12, 30) : new Date(year + 1, 7, 31),
      createdByAccount: this.accountId,
    }));
  }

  async getGradesForPeriod(period: Period): Promise<PeriodGrades> {
    if (!this.isAuriga) {
      return {
        studentOverall: { value: 0 },
        classAverage: { value: 0 },
        subjects: [],
        createdByAccount: this.accountId,
      };
    }

    const semesterNum = period.id ? parseInt(period.id.replace("S", "")) : 0;
    const allEnriched = AurigaAPI.getEnrichedGrades();
    if (!allEnriched || allEnriched.length === 0) {
      throw new Error("No enriched grades available from AurigaAPI");
    }
    const enrichedGrades = allEnriched.filter(
      g => g.semester === semesterNum
    );
    const syllabusList = AurigaAPI.getAllSyllabus();

    // Exam-type codes, learned from the syllabuses (used by splitEcueAndExam).
    const knownExamTypes = new Set<string>(DEFAULT_EXAM_TYPES);
    syllabusList.forEach(s =>
      s.exams?.forEach(e => {
        if (e.type) {
          knownExamTypes.add(e.type);
        }
      })
    );

    const subjectsMap: Record<string, Subject> = {};

    enrichedGrades.forEach(g => {
      // Subject code = everything after _SXX_, e.g. "CN_PC_PSE_EXA_1"
      const gradeFullCode = extractSubjectCode(g.name);

      // Prefix match on the stable subject code (syllabus has no exam suffix)
      const matchingSyllabus = syllabusList.find(s => {
        const syllabusSubjectCode = extractSubjectCode(s.name);
        return (
          gradeFullCode.startsWith(syllabusSubjectCode + "_") ||
          gradeFullCode === syllabusSubjectCode
        );
      });

      // Stable ECUE code to group by (never the display name or the full grade
      // code, which carries the exam suffix), plus the exam part of the code.
      let ecueCode: string;
      let examPart: string;
      if (matchingSyllabus) {
        ecueCode = extractSubjectCode(matchingSyllabus.name);
        examPart = gradeFullCode.startsWith(ecueCode + "_")
          ? gradeFullCode.substring(ecueCode.length + 1)
          : "";
      } else {
        const split = splitEcueAndExam(gradeFullCode, knownExamTypes);
        ecueCode = split.ecueCode;
        examPart = split.examPart;
      }

      const ueCode = ecueCode.split("_")[0] || "OTHER";

      const subjectName =
        matchingSyllabus?.caption?.name ||
        matchingSyllabus?.name?.replace(/\.[^.]+$/, "") ||
        ecueCode;

      const subjectKey = ecueCode;

      const examType = g.type || "";
      let description = examType || "Note";

      // Coefficient comes from the grades API (row[2], a percentage); the syllabus
      // weighting is only a fallback when the API gives none.
      const apiCoeff =
        g.coefficient !== undefined && Number.isFinite(g.coefficient)
          ? g.coefficient / 100
          : undefined;
      let coefficient = apiCoeff ?? 1;

      if (matchingSyllabus) {
        // Parse exam type and index from examPart (e.g. "EXA_1" or "EXF")
        const examPartParts = examPart.split("_");
        const examTypeFromPart = examPartParts[0];
        const examIndexFromPart = examPartParts[1]
          ? parseInt(examPartParts[1], 10)
          : undefined;

        // Grade codes number evaluations per type (EXA_1, EXA_2…) while the
        // syllabus `index` is global, so match by per-type position: the Nth
        // syllabus component of this type, in API order.
        const sameTypeExams = (matchingSyllabus.exams || []).filter(
          e => e.type === examTypeFromPart
        );
        const matchingExam =
          sameTypeExams.length <= 1
            ? sameTypeExams[0]
            : sameTypeExams[(examIndexFromPart ?? 1) - 1];

        // Use the syllabus exam's typeName for description if available
        if (matchingExam) {
          const examDescription =
            typeof matchingExam.description === "string"
              ? matchingExam.description
              : matchingExam.description?.fr || matchingExam.description?.en;

          if (examDescription && matchingExam.typeName) {
            // Combine typeName and description
            description = `${matchingExam.typeName} - ${examDescription}`;
          } else if (examDescription) {
            description = examDescription;
          } else if (matchingExam.typeName) {
            description = matchingExam.typeName;
          } else if (examPart) {
            description = examPart.replace(/_/g, " ");
          }
        } else if (examPart) {
          description = examPart.replace(/_/g, " ");
        }

        // Fallback only: use the syllabus weighting when the API gave us none.
        if (apiCoeff === undefined && matchingExam && matchingExam.weighting) {
          // Convert percentage to decimal (e.g., 30 -> 0.30)
          coefficient = matchingExam.weighting / 100;
        }
      }

      // Store UE code with subject for later grouping
      if (!subjectsMap[subjectKey]) {
        subjectsMap[subjectKey] = {
          id: subjectKey,
          name: subjectName,
          studentAverage: { value: 0 },
          classAverage: { value: 0 },
          outOf: { value: 20 },
          grades: [],
        };
        // Track UE code and syllabus coefficient separately
        (subjectsMap[subjectKey] as any)._ueCode = ueCode;
        (subjectsMap[subjectKey] as any)._syllabusCoeff = matchingSyllabus?.coeff;
      }

      const gradeItem: SharedGrade = {
        id: String(g.code),
        subjectId: subjectKey,
        subjectName: subjectName,
        description: description,
        givenAt: g.syncedAt ? new Date(g.syncedAt) : new Date(), // Use preserved sync date
        studentScore: { value: g.grade },
        outOf: { value: 20 },
        coefficient: coefficient,
        createdByAccount: this.accountId,
        alphaMark: g.alphaMark, // VA, NV for validation grades
        _gradeCode: gradeFullCode, // Store grade code pattern for rattrapage matching
        _isSAE: g.type === "SAE", // SAE projects are pass/fail, kept out of the /20 average
      };

      subjectsMap[subjectKey].grades?.push(gradeItem);
    });

    // Calculate weighted averages per subject, handling VA/NV grades and rattrapage
    Object.values(subjectsMap).forEach(s => {
      const sGrades = s.grades || [];

      // Handle rattrapage (EXF) replacing original exam (EXA) if better
      // Group grades by their base exam type (EXA_1, EXA, etc.)
      const gradesByExam: Record<string, SharedGrade[]> = {};
      sGrades.forEach(grade => {
        // Use stored grade code pattern for exam type detection
        const gradeCode = (grade as any)._gradeCode || '';
        // Extract exam type from description (e.g., "Examen Final" -> EXF, "Examen" -> EXA)
        const isRattrapage = grade.description?.toLowerCase().includes('rattrapage') ||
          gradeCode.includes('_EXF') || gradeCode.includes('_EXF_');
        const isExam = grade.description?.toLowerCase().includes('examen') ||
          gradeCode.includes('_EXA') || gradeCode.includes('_EXA_');

        if (isRattrapage || isExam) {
          // Extract base exam identifier (e.g., "EXA_1" -> "EXA_1", "EXF_1" -> "EXA_1")
          const examMatch = gradeCode.match(/_EX[AF](_\d+)?$/);
          const baseExam = examMatch ? examMatch[0].replace('_EXF', '_EXA') : '_EXA';

          if (!gradesByExam[baseExam]) {
            gradesByExam[baseExam] = [];
          }
          gradesByExam[baseExam].push(grade);
        } else {
          // Non-exam grade, use unique key
          gradesByExam[grade.id] = [grade];
        }
      });

      // For each exam group, keep only the best grade
      const effectiveGrades: SharedGrade[] = [];
      Object.values(gradesByExam).forEach(examGrades => {
        if (examGrades.length === 1) {
          effectiveGrades.push(examGrades[0]);
        } else {
          // Multiple grades (e.g., EXA and EXF) - keep the best one
          const bestGrade = examGrades.reduce((best, current) => {
            const bestScore = best.studentScore?.value ?? 0;
            const currentScore = current.studentScore?.value ?? 0;
            return currentScore > bestScore ? current : best;
          });
          effectiveGrades.push(bestGrade);
        }
      });

      let totalWeightedScore = 0;
      let totalWeight = 0;
      let allValidation = true; // True if all grades are VA/NV
      let hasNV = false; // True if any grade is NV

      effectiveGrades.forEach(grade => {
        // Validation grades (VA/NV) and SAE projects are pass/fail: never counted
        // as a /20 score (an SAE must not drag the average down as a 0).
        if (grade.alphaMark || grade._isSAE) {
          if (grade.alphaMark === "NV") {
            hasNV = true;
          }
        } else {
          // Numeric grade - include in average
          allValidation = false;
          const score = grade.studentScore?.value || 0;
          const weight = grade.coefficient || 1;
          totalWeightedScore += score * weight;
          totalWeight += weight;
        }
      });

      // Mark subject properties
      s.isValidationOnly = sGrades.length > 0 && allValidation;
      s.hasNonValidated = hasNV;

      // Calculate average (only for non-validation subjects)
      if (s.isValidationOnly) {
        s.studentAverage = { value: 0, outOf: 20 };
      } else {
        s.studentAverage = {
          value: totalWeight > 0 ? totalWeightedScore / totalWeight : 0,
          outOf: 20,
        };
      }
    });

    const subjects = Object.values(subjectsMap);

    // Group subjects by UE code
    const ueGroups: Record<string, Subject[]> = {};
    subjects.forEach(s => {
      const ueCode = (s as any)._ueCode || "OTHER";
      if (!ueGroups[ueCode]) {
        ueGroups[ueCode] = [];
      }
      ueGroups[ueCode].push(s);
    });

    // Create UE modules with averages
    const modules: Subject[] = Object.entries(ueGroups).map(
      ([ueCode, ueSubjects]) => {
        // Check if any subject has NV (Non validé)
        const hasNV = ueSubjects.some(s => s.hasNonValidated);

        // Check if all subjects are validation-only
        const allValidationOnly = ueSubjects.every(s => s.isValidationOnly);

        // Calculate UE average using weighted coefficients from syllabus
        const numericSubjects = ueSubjects.filter(s => !s.isValidationOnly);

        // Use syllabus coefficients for weighted average calculation
        let ueWeightedTotal = 0;
        let ueTotalWeight = 0;

        numericSubjects.forEach(s => {
          const syllabusCoeff = (s as any)._syllabusCoeff;
          const weight = syllabusCoeff !== undefined ? syllabusCoeff : 1;
          ueWeightedTotal += (s.studentAverage?.value || 0) * weight;
          ueTotalWeight += weight;
        });

        const ueAverage = ueTotalWeight > 0 ? ueWeightedTotal / ueTotalWeight : 0;

        const ueNames: Record<string, string> = {
          PR: "Produire",
          AG: "Agir",
          CN: "Concevoir",
          PROJET: "Projet",
          PL: "Piloter",
          SH: "Sciences Humaines",
          STOUV: "Stage Ouvrier",
          CDSF: "Cahier des Spécifications Fonctionnel",
          MIF: "Mathématiques et Informatique Fondamentales",
          MIA: "Mathématiques et Informatique Avancées",
          LANGAGES: "Ingénierie des Sciences du Numériques - LANGAGES",
          BASES: "Ingénierie des Sciences du Numériques - BASES",
          CYBER: "Cybersécurité (techniques et outils)",
          SHSJC: "Sciences Humaines, Sociales, Juridiques et de Communication",
          ENT: "Rapport de stage",
        };

        return {
          id: ueCode,
          name: ueNames[ueCode] || ueCode,
          studentAverage: { value: ueAverage, outOf: 20 },
          classAverage: { value: 0 },
          outOf: { value: 20 },
          grades: [], // UE modules don't have direct grades
          subjects: ueSubjects, // Add nested subjects
          isValidationOnly: allValidationOnly,
          hasNonValidated: hasNV,
        };
      }
    );

    // Calculate overall average as mean of UE averages (excluding validation-only UEs)
    const numericModules = modules.filter(m => !m.isValidationOnly);
    const overallTotal = numericModules.reduce(
      (sum, m) => sum + (m.studentAverage?.value || 0),
      0
    );
    const overallAverage =
      numericModules.length > 0 ? overallTotal / numericModules.length : 0;

    return {
      studentOverall: { value: overallAverage, outOf: 20 },
      classAverage: { value: 0 },
      subjects: subjects,
      modules: modules, // UE groups for display
      createdByAccount: this.accountId,
    };
  }
}
