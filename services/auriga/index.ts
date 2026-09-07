import { MMKV } from "react-native-mmkv";

import { addSubjectsToDatabase } from "@/database/useSubject";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { registerSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { cleanSubjectName } from "@/utils/subjects/utils";

import { Coeff, EdtEvent, Grade, Syllabus, UserData } from "./types";
import { addCourseDayToDatabase } from "@/database/useTimetable";
import { Course, CourseDay, CourseStatus, CourseType } from "../shared/timetable";
import { desc } from "@nozbe/watermelondb/QueryDescription";

// Initialize MMKV storage
export const storage = new MMKV({
  id: "auriga-storage",
});

/**
 * Extracts the stable subject code from a grade/syllabus name.
 * Pattern: YYYY_[SECTION]_[...]_SXX_[SUBJECT_CODE]
 * Returns everything after the _SXX_ pattern.
 * Examples:
 *   - "2526_B_CYBER_S03_MIA_IGM" -> "MIA_IGM"
 *   - "2526_I_INF_FISE_S03_CN_PC_AL" -> "CN_PC_AL"
 */
export function extractSubjectCode(name: string): string {
  const match = name.match(/_S\d{2}_(.+)$/);
  return match ? match[1] : name;
}

/**
 * Checks if a name indicates a Bachelor section account.
 * Bachelor accounts have _B_ after the year prefix.
 */
export function isBachelorSection(name: string): boolean {
  return /^\d{4}_B_/.test(name);
}

const BASE_URL = "https://my.esme.fr/api";

const PAYLOADS = {
  coeffs: "https://gitlab.com/epimac-asso/projects/chrysalide/ChrysalideApp/-/raw/main/services/auriga/payloads/coeffs.json?",
  grades: "https://gitlab.com/epimac-asso/projects/chrysalide/ChrysalideApp/-/raw/main/services/auriga/payloads/grades.json",
  syllabus: "https://gitlab.com/epimac-asso/projects/chrysalide/ChrysalideApp/-/raw/main/services/auriga/payloads/syllabus.json"
};

async function getPayload(payload: keyof typeof PAYLOADS) {
  const payloadUrl = PAYLOADS[payload];
  const response = await fetch(payloadUrl, {
    method: "GET",
    headers: {}
  });
  let data = await response.json();

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  return data;
}

class AurigaAPI {
  private token: string | null = null;
  private cookie: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.token = token;
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  setCookie(cookie: string) {
    this.cookie = cookie;
  }

  /**
   * Initializes MMKV cache from WatermelonDB if empty.
   * Should be called at app startup to restore persisted data.
   */
  async initializeFromDatabase() {
    const { getDatabaseInstance } = await import("@/database/DatabaseProvider");
    const { Grade } = await import("@/database/models/Grades");

    const cachedGrades = storage.getString("auriga_grades");
    if (!cachedGrades || cachedGrades === "[]") {
      console.log("No MMKV grades cache found, will fetch fresh on next sync.");
    }
  }

  /**
   * Syncs all data from Auriga (Grades, Syllabus) and stores it in local storage.
   * @param onLog Optional callback to receive log messages during sync (for UI display)
   */
  async sync(onLog?: (message: string) => void) {
    const log = (msg: string) => {
      console.log(msg);
      if (onLog) {
        onLog(msg);
      }
    };

    const store = useAccountStore.getState();
    const aurigaService = store.accounts
      .flatMap((acc: any) => acc.services)
      .find((s: any) => s.auth?.additionals?.type === "auriga" || s.serviceId === Services.MULTI);
    const aurigaServiceId = aurigaService ? aurigaService.id : "auriga";

    let fetchedEDT: EdtEvent[] = [];
    let fetchedGrades: Grade[] = [];
    let fetchedSyllabus: Syllabus[] = [];
    let fetchedUserData: UserData | null = null;

    log("[AURIGA] Récupération des données...")
    try {
      const edt = await this.fetchAllEDT();
      if (edt.length > 0) {
        storage.set("auriga_edt", JSON.stringify(edt));
        log(`[AURIGA] ${edt.length} cours récupérés.`);

        const dayMap: Record<string, CourseDay> = {};
        edt.forEach(lesson => {
          const fromDate = new Date(lesson.startTime);
          const toDate = new Date(lesson.endTime);

          const dayKey = fromDate.getFullYear() + "-" +
            String(fromDate.getMonth() + 1).padStart(2, '0') + "-" +
            String(fromDate.getDate()).padStart(2, '0');

          if (!dayMap[dayKey]) {
            dayMap[dayKey] = {
              date: new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()),
              courses: []
            };
          }

          dayMap[dayKey].courses.push({
            subject: lesson.name.name,
            id: String(lesson.id),
            type: lesson.activityType.code == "TD" ? CourseType.TD : lesson.activityType.code == "CM" ? CourseType.CM : lesson.activityType.code == "EXAM" ? CourseType.EXAM : CourseType.OTHER,
            from: fromDate,
            to: toDate,
            additionalInfo: lesson.description || undefined,
            cancel: lesson.interventionStatus.code != "PLANIFIE",
            room: lesson.locations
              .map((element: any) => `${String(element.code.split('_')[3])}(${element.floor}e)`)
              .filter(Boolean)
              .join(", "),
            teacher: lesson.instructors
              .map((element: any) => `${element.firstName} ${element.lastName}`)
              .filter(Boolean)
              .join(", "),
            group: lesson.class
              .map((element: any) => String(element.code).split('_')[5])
              .filter(Boolean)
              .join(", "),
            isExam: lesson.activityType.isExam,
            duration: lesson.duration,
            backgroundColor: lesson.activityType.isExam ? "#ff453a" : "#0060D6",
            status: lesson.activityType.isExam ? CourseStatus.EVALUATED : lesson.activityType.code == "TD" ? CourseStatus.TD : lesson.activityType.code == "CM" ? CourseStatus.CM : undefined,
            createdByAccount: aurigaServiceId,
          });
        });

        let courseDayList: CourseDay[] = Object.values(dayMap);

        addCourseDayToDatabase(courseDayList);

      } else {
        log("[AURIGA] Aucun cours trouvé.");
        const cached = storage.getString("auriga_edt");
        if (cached) {
          fetchedEDT = JSON.parse(cached);
        }
      }
    } catch (e) {
      console.error("[AURIGA] Erreur lors de la récupération des cours:", e);
    }

    log("[AURIGA] Récupération des notes...");
    try {
      fetchedGrades = await this.fetchAllGrades();
      if (fetchedGrades.length > 0) {
        const existingCached = storage.getString("auriga_grades");
        const existingGrades: Grade[] = existingCached
          ? JSON.parse(existingCached)
          : [];

        const existingGradesMap = new Map<string, Grade>();
        existingGrades.forEach(g => existingGradesMap.set(g.code, g));

        const now = Date.now();
        fetchedGrades = fetchedGrades.map(g => {
          const existing = existingGradesMap.get(g.code);
          return {
            ...g,
            syncedAt: existing?.syncedAt || now,
          };
        });

        storage.set("auriga_grades", JSON.stringify(fetchedGrades));
        log(`[AURIGA] ${fetchedGrades.length} notes récupérées.`);
      } else {
        log("[AURIGA] Aucune note récupérée.");
        const cached = storage.getString("auriga_grades");
        if (cached) {
          fetchedGrades = JSON.parse(cached);
        }
      }
    } catch (e) {
      console.error("Failed to fetch grades:", e);
      const cached = storage.getString("auriga_grades");
      if (cached) {
        fetchedGrades = JSON.parse(cached);
      }
    }

    log("[AURIGA] Récupération des syllabus...");
    try {
      fetchedSyllabus = await this.fetchAllSyllabus();
      if (fetchedSyllabus.length > 0) {
        storage.set("auriga_syllabus", JSON.stringify(fetchedSyllabus));
        log(`[AURIGA] ${fetchedSyllabus.length} syllabus récupérés.`);
        for (const s of fetchedSyllabus) {
          log(
            `[AURIGA] | (Syllabus) ${s.name} | UE: ${s.UE} | S${s.semester} | ${s.caption?.name || "No caption"}`
          );
        }
      } else {
        log("[AURIGA] Aucun syllabus récupéré.");
        const cached = storage.getString("auriga_syllabus");
        if (cached) {
          fetchedSyllabus = JSON.parse(cached);
        }
      }

      const subjectsToAdd = fetchedSyllabus.map((s: Syllabus) => ({
        id: s.name || String(s.id),
        name: s.caption?.name || s.name || String(s.id),
        studentAverage: {
          value: s.grade ?? 0,
          disabled: s.grade === undefined,
        },
        classAverage: { value: 0, disabled: true },
        maximum: { value: 0, disabled: true },
        minimum: { value: 0, disabled: true },
        outOf: { value: 20 },
      }));

      await addSubjectsToDatabase(subjectsToAdd);

      const store = useAccountStore.getState();
      for (const s of fetchedSyllabus) {
        const subjectName = s.caption?.name || s.name || String(s.id);
        const cleanedName = cleanSubjectName(subjectName);

        registerSubjectColor(subjectName);

        const emoji = getSubjectEmoji(subjectName);

        store.setSubjectName(cleanedName, subjectName);
        store.setSubjectEmoji(cleanedName, emoji);
      }
      log(
        `[AURIGA] ${fetchedSyllabus.length} matières enregistrées.`
      );
    } catch (e) {
      console.error("[AURIGA] Erreur lors de la récupération des syllabus:", e);
    }

    log("[AURIGA] Récupération des données utilisateur...");
    try {
      fetchedUserData = await this.fetchUserData();
      if (fetchedUserData) {
        storage.set("auriga_userdata", JSON.stringify(fetchedUserData));
        log("[AURIGA] Données utilisateur récupérées.");
      } else {
        log("[AURIGA] Aucune donnée utilisateur récupérée.");
        const cached = storage.getString("auriga_userdata");
        if (cached) {
          fetchedUserData = JSON.parse(cached);
        }
      }
    } catch (e) {
      console.error("[AURIGA] Erreur lors de la récupération des données utilisateur:", e);
    }

    log("[AURIGA] Synchronisation terminée!");

    return {
      grades: this.getAllGrades(),
      syllabus: this.getAllSyllabus(),
      userData: fetchedUserData || this.getStudentData(),
    };
  }

  getStudentData(): UserData | null {
    const data = storage.getString("auriga_userdata");
    return data ? JSON.parse(data) : null;
  }

  getAllGrades(): Grade[] {
    const data = storage.getString("auriga_grades");
    return data ? JSON.parse(data) : [];
  }

  getGradeByCode(code: string): Grade | undefined {
    return this.getAllGrades().find(g => g.code.toString() === code);
  }

  async getAllCoeffs(): Promise<Coeff[]> {
    let headers: any = {};
    if (this.token) {
      headers = {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      };
    } else {
      headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://my.esme.fr",
        Referer: "https://my.esme.fr/",
        "X-Requested-With": "XMLHttpRequest",
      };

      if (this.cookie) {
        headers["Cookie"] = this.cookie;
        const xsrfMatch = this.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          headers["X-XSRF-TOKEN"] = xsrfMatch[1];
        }
      }
    }

    const payload = await getPayload("coeffs");
    const response = await fetch(`https://my.esme.fr/api/menuEntries/1144/searchResult?size=300&page=1&sort=id`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!response.ok || (contentType && contentType.includes("text/html"))) {
      console.error(`Auriga API Error [COEFFS] (${response.status}):`);
      throw new Error(`Auriga API Error (${response.status}) on COEFFS`);
    }

    const data = await response.json();

    return data.content.lines.map((coeff: any) => ({
      name: coeff[3],
      value: coeff[5],
    }));
  }


  /**
   * Returns grades enriched with syllabus exam descriptions and weightings.
   * Uses PREFIX MATCHING for year/semester-agnostic matching.
   */
  getEnrichedGrades(): (Grade & { description: string; weighting: number })[] {
    const allGrades = this.getAllGrades();
    const syllabusList = this.getAllSyllabus();

    return allGrades.map(g => {
      const gradeFullCode = extractSubjectCode(g.name);

      const matchingSyllabus = syllabusList.find(s => {
        const syllabusSubjectCode = extractSubjectCode(s.name);
        return (
          gradeFullCode.startsWith(syllabusSubjectCode + "_") ||
          gradeFullCode === syllabusSubjectCode
        );
      });

      if (matchingSyllabus) {
        const syllabusSubjectCode = extractSubjectCode(matchingSyllabus.name);
        const examPart = gradeFullCode.substring(
          syllabusSubjectCode.length + 1
        );
        const examParts = examPart.split("_");
        const examType = examParts[0];
        const examIndex = examParts[1] ? parseInt(examParts[1], 10) : undefined;

        const matchingExam = matchingSyllabus.exams?.find(e => {
          if (e.type !== examType) {
            return false;
          }
          if (examIndex !== undefined) {
            return e.index === examIndex;
          }
          return true;
        });

        if (matchingExam) {
          const examDescription =
            typeof matchingExam.description === "string"
              ? matchingExam.description
              : matchingExam.description?.fr || matchingExam.description?.en;

          let description = matchingExam.typeName || matchingExam.type || "";
          if (examDescription && matchingExam.typeName) {
            description = `${matchingExam.typeName} - ${examDescription}`;
          } else if (examDescription) {
            description = examDescription;
          }

          return {
            ...g,
            description,
            weighting: matchingExam.weighting ?? 1,
          };
        }
      }

      return {
        ...g,
        description: g.type || g.name,
        weighting: 1,
      };
    });
  }

  getAllSyllabus(): Syllabus[] {
    const data = storage.getString("auriga_syllabus");
    return data ? JSON.parse(data) : [];
  }

  getSyllabusBySemester(semester: number): Syllabus[] {
    return this.getAllSyllabus().filter(s => s.semester === semester);
  }

  /**
   * Fetches the access token using the session cookies.
   */
  async fetchToken(): Promise<string | null> {
    try {
      const tokenUrl = "https://my.esme.fr/api/token";

      const headers: any = {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: "https://my.esme.fr",
        Referer: "https://my.esme.fr/",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1", // Mock User Agent
      };

      if (this.cookie) {
        headers["Cookie"] = this.cookie;

        const xsrfMatch = this.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          headers["X-XSRF-TOKEN"] = xsrfMatch[1];
        }
      }

      const response = await fetch(tokenUrl, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        console.error(`[AURIGA] Erreur lors de la récupération du token: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data && data.access_token) {
        console.log("[AURIGA] Token récupéré avec succès!");
        this.token = data.access_token;
        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error("[AURIGA] Erreur lors de la récupération du token:", error);
      return null;
    }
  }

  private async postDataToAuriga(endpoint: string, payload: any) {
    let headers: any = {};

    if (this.token) {
      headers = {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      };
    } else {
      headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://my.esme.fr",
        Referer: "https://my.esme.fr/",
        "X-Requested-With": "XMLHttpRequest",
      };

      if (this.cookie) {
        headers["Cookie"] = this.cookie;
        const xsrfMatch = this.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          headers["X-XSRF-TOKEN"] = xsrfMatch[1];
        }
      }
    }

    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!response.ok || (contentType && contentType.includes("text/html"))) {
      console.error(`[AURIGA] Erreur API [${endpoint}] (${response.status}):`);
      throw new Error(`[AURIGA] Erreur API (${response.status}) on ${endpoint}`);
    }

    return await response.json();
  }

  private async fetchAllEDT(): Promise<EdtEvent[]> {
    try {
      const allEDT: EdtEvent[] = [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const startYear = now.getMonth() >= 7 ? currentYear : currentYear - 1;
      const startDate = `${startYear}-09-01`;
      const endDate = `${startYear + 1}-08-31`;

      const endpoint = `plannings/me?days=1&days=2&days=3&days=4&days=5&days=6&days=7&startDate=${startDate}&endDate=${endDate}`;
      console.log(`[AURIGA] | (EDT) Récupération des cours du ${startDate} au ${endDate}...`);

      const response = await this.getDataFromAuriga(endpoint);

      let interventions = response || [];
      if (response && response.interventions && Array.isArray(response.interventions)) {
        interventions = response.interventions;
      }

      if (Array.isArray(interventions)) {
        interventions.forEach((element: any) => {
          try {
            const courseCode = element.interventionPedagogicalUnits?.[0]?.pedagogicalUnit?.code || "Inconnu";
            console.log(`[AURIGA] | (EDT) Code: "${courseCode}" -> Start: ${element.startDateTime} -> End: ${element.endDateTime}`);
            allEDT.push({
              id: element.id,
              name: {
                code: element.interventionPedagogicalUnits?.[0]?.pedagogicalUnit?.code || "",
                name: element.interventionPedagogicalUnits?.[0]?.pedagogicalUnit?.caption?.fr || ""
              },
              UE: element.interventionPedagogicalUnits?.[0]?.pedagogicalUnit?.customAttributes?.UE?.id || "",
              day: element.startDateTime ? element.startDateTime.split("T")[0] : "",
              startTime: element.startDateTime || "",
              endTime: element.endDateTime || "",
              duration: element.duration,
              description: element.interventionResources?.resource?.description || undefined,
              timeZone: "UTC+1",
              activityType: {
                code: element.activityType?.code || "",
                name: element.activityType?.caption?.fr || "",
                isExam: element.isExam || false
              },
              interventionStatus: {
                code: element.interventionStatus?.code || "PLANIFIE",
              },
              instructors: (element.interventionInstructors || []).map((instructor: any) => ({
                firstName: instructor.person?.currentFirstName || "",
                lastName: instructor.person?.currentLastName || "",
                login: (instructor.person?.currentFirstName || "").toLowerCase() + "." + (instructor.person?.currentLastName || "").toLowerCase()
              })),
              class: (element.interventionPopulations || []).map((classStudents: any) => ({
                code: classStudents.population?.code || "",
                name: classStudents.population?.caption?.fr || ""
              })),
              locations: (element.interventionResources || []).map((location: any) => ({
                code: location.resource?.code || "",
                name: location.resource?.caption?.fr || "",
                classType: {
                  code: location.resource?.resourceType?.code || "",
                  name: location.resource?.resourceType?.caption?.fr || ""
                },
                capacity: {
                  cours: location.resource?.totalCapacity || 0,
                  exam: location.resource?.examCapacity || 0
                },
                floor: location.resource?.floor || 0
              }))
            });
          } catch (err) {
            console.warn("[AURIGA] | (EDT) Erreur lors du parsing de l'intervention: ", err);
          }
        });
      }
      console.log(`[AURIGA] | (EDT) Fin du traitement. Total d'éléments: ${allEDT.length}`);
      return allEDT;

    } catch (e) {
      console.warn("[AURIGA] | (EDT) Erreur lors de la récupération des cours:", e);
      return [];
    }
  }

  private async fetchAllGrades(): Promise<Grade[]> {
    try {
      const allGrades: Grade[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const endpoint = `menuEntries/1036/searchResult?size=100&page=${page}&sort=id&disableWarnings=true`;
        const payload = await getPayload("grades");
        const response = await this.postDataToAuriga(endpoint, payload);

        if (response && response.totalPages) {
          totalPages = response.totalPages;
        }

        const lines = response?.content?.lines || [];

        lines.forEach((row: any) => {
          if (!Array.isArray(row) || row.length < 5) {
            return;
          }

          const itemCode = row[0];
          const gradeValue = row[1];
          const coefficient = row[2]; // per-evaluation coefficient (%)
          const itemName = row[3];
          const typeName = row[4];

          let semester = 0;
          const codeStr = String(itemName);
          const match = codeStr.match(/_S(\d+)_/i);
          if (match) {
            semester = parseInt(match[1]);
          }

          if (gradeValue !== null && gradeValue !== undefined) {
            const gradeStr = String(gradeValue).trim();

            // Empty cell = not graded yet; skip it (Number("") === 0 otherwise).
            if (gradeStr === "") {
              return;
            }

            let alphaMark: string | undefined;
            let numericGrade = 0;
            let isNumeric = false;

            if (gradeStr === "VA" || gradeStr === "Validé") {
              alphaMark = "VA";
            } else if (gradeStr === "NV" || gradeStr === "Non validé") {
              alphaMark = "NV";
            } else {
              const parsed = Number(gradeStr.replace(",", "."));
              if (Number.isNaN(parsed)) {
                return; // non-numeric, non-validation value
              }
              numericGrade = parsed; // keep real zeros
              isNumeric = true;
            }

            if (isNumeric || alphaMark) {
              const coeffNum = Number(coefficient);
              allGrades.push({
                code: String(itemCode),
                type: String(typeName),
                name: codeStr,
                semester: semester,
                grade: numericGrade,
                coefficient: Number.isFinite(coeffNum) ? coeffNum : undefined,
                alphaMark: alphaMark,
              });
            }
          }
        });

        console.log(
          `[AURIGA] | (Grades) Page ${page} traitée. Total de notes jusqu'à présent: ${allGrades.length}`
        );

        page++;
      } while (page <= totalPages);

      return allGrades;
    } catch (e) {
      console.warn("[AURIGA] | (Grades) Erreur lors de la récupération des notes:", e);
      return [];
    }
  }

  private async fetchAllSyllabus(): Promise<Syllabus[]> {
    let allIds: string[] = [];

    const fetchWithToken = async (
      endpoint: string,
      method: "GET" | "POST",
      body?: any
    ) => {
      if (!this.token) {
        throw new Error("No access token available for Auriga sync");
      }

      const headers: any = {
        Authorization: "Bearer " + this.token,
      };

      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${BASE_URL}/${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Auriga API Error ${response.status} on ${endpoint}: ${text}`
        );
      }

      return await response.json();
    };

    try {
      console.log("[AURIGA] | (Syllabus) Récupération des définitions du catalogue de cours...");
      const definitionUrl =
        "menuEntries/166/courseCatalogDefinitions?sortBy=code,asc";

      const definitions = await fetchWithToken(definitionUrl, "GET");

      if (!definitions || !definitions.content) {
        throw new Error("No content in course catalog definitions");
      }

      console.log(
        `[AURIGA] | (Syllabus) Trouvé ${definitions.content.length} catalogues de cours. Récupération des syllabus pour chacun...`
      );

      const searchUrl = "menuEntries/166/searchResult?size=100&page=1&sort=id";
      const payload = await getPayload("syllabus");

      for (const element of definitions.content) {
        try {
          if (payload.searchResultDefinition?.filtersCustom) {
            payload.searchResultDefinition.filtersCustom.id = element.id;
          }

          const response = await fetchWithToken(searchUrl, "POST", payload);

          const lines = response?.content?.lines || [];
          const ids = lines.map((l: any) => l[0]);

          if (ids.length > 0) {
            allIds.push(...ids);
          }
          console.log(
            `[AURIGA] | (Syllabus) Catalogue ${element.code} a ${ids.length} syllabus.`
          );
        } catch (e) {
          console.warn(
            `[AURIGA] | (Syllabus) Erreur lors de la récupération des syllabus pour le catalogue ${element.id}:`,
            e
          );
        }
      }

      allIds = [...new Set(allIds)];
      console.log(`[AURIGA] | (Syllabus) Total d'identifiants de syllabus uniques trouvés: ${allIds.length}`);
    } catch (e) {
      console.error("[AURIGA] | (Syllabus) Erreur lors de la récupération des identifiants de syllabus (synchronisation des syllabus ignorée):");
      return [];
    }

    console.log("[AURIGA] | (Coeffs) Récupération des coefficients...");
    let coeffs: Coeff[] = [];
    try {
      coeffs = await this.getAllCoeffs();
      console.log(`[AURIGA] | (Coeffs) Récupération de ${coeffs.length} coefficients.`);
    } catch (e) {
      console.warn("Failed to fetch coefficients:", e);
    }

    console.log("Fetching details for syllabuses...");
    const syllabusDetails: Syllabus[] = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (id: string) => {
          try {
            const endpoint = `menuEntries/166/syllabuses/${id}`;
            const detailRes = await fetchWithToken(endpoint, "GET");
            const mapped = this.mapSyllabusDetail(detailRes, coeffs);
            if (mapped) {
              syllabusDetails.push(mapped);
            }
          } catch (e) {
            console.warn(`[AURIGA] | (Syllabus) Erreur lors de la récupération du syllabus ${id}:`, e);
          }
        })
      );
    }

    return syllabusDetails;
  }

  private async fetchUserData(): Promise<UserData | null> {
    try {
      const endpoint = "me";
      const userData = await this.getDataFromAuriga(endpoint);

      if (!userData || !userData.person) {
        return null;
      }

      const userDataSync: UserData = {
        parent1: {
          firstName: userData.person.customAttributes?.RL1_FirstName || "",
          lastName: userData.person.customAttributes?.RL1_Name || "",
          email: userData.person.customAttributes?.RL1_Mail || "",
          phone: userData.person.customAttributes?.RL1_Phone || "",
          address: userData.person.customAttributes?.RL1_AddressC || "",
          city: userData.person.customAttributes?.RL1_Town || "",
          zipCode: userData.person.customAttributes?.RL1_Postcode || "",
          country: userData.person.customAttributes?.RL1_Country?.id || 0,
        },
        parent2: {
          firstName: userData.person.customAttributes?.RL2_FirstName || "",
          lastName: userData.person.customAttributes?.RL2_Name || "",
          email: userData.person.customAttributes?.RL2_Mail || "",
          phone: userData.person.customAttributes?.RL2_Phone || "",
          address: userData.person.customAttributes?.RL2_AddressC || "",
          city: userData.person.customAttributes?.RL2_Town || "",
          zipCode: userData.person.customAttributes?.RL2_Postcode || "",
          country: userData.person.customAttributes?.RL2_Country?.id || 0,
        },
        financialGuarantor: {
          firstName: userData.person.customAttributes?.GF1_FirstName || "",
          lastName: userData.person.customAttributes?.GF1_Name || "",
          email: userData.person.customAttributes?.GF1_Mail || "",
          phone: userData.person.customAttributes?.GF1_Phone || "",
          address: userData.person.customAttributes?.GF1_AddressC || "",
          city: userData.person.customAttributes?.GF1_Town || "",
          zipCode: userData.person.customAttributes?.GF1_Postcode || "",
          country: userData.person.customAttributes?.GF1_Country?.id || 0,
        },
        student: {
          login: userData.person.customAttributes?.UID || "",
          class: userData.person.customAttributes?.EntryClass || "",
          schoolMail: userData.person.contactDetails?.[0]?.contactInformation || "",
          mail: userData.person.contactDetails?.[1]?.contactInformation || "",
          phone: userData.person.contactDetails?.[2]?.contactInformation || "",
          firstName: userData.person.currentFirstName || "",
          lastName: userData.person.currentLastName || "",
          birthDate: userData.person.birthDate || "",
          cityOfBirth: userData.person.cityOfBirth || "",
          countryOfBirth: userData.person.countryOfBirth?.iso639_1Code || "",
          gender: userData.person.gender?.code || "",
          adress: {
            street1: userData.person.addresses?.[0]?.street1 || "",
            street2: userData.person.addresses?.[0]?.street2 || "",
          },
          city: userData.person.addresses?.[0]?.city || "",
          country: userData.person.addresses?.[0]?.country?.iso639_1Code || "",
          entryYear: userData.person.higherEducationEntryYear || 0,
        },
        highSchool: {
          option1: userData.person.siseBacOption1?.code || "",
          option2: userData.person.siseBacOption2?.code || "",
          language1: userData.person.siseLanguage1?.caption?.en || "",
          language2: userData.person.siseLanguage2?.caption?.en || "",
          examType: userData.person.siseBacSeries?.code || "",
          department: userData.person.bacFrenchDepartment?.code || "",
        },
      };

      return userDataSync;
    } catch (error) {
      console.warn("[AURIGA] | (UserData) Erreur lors de la récupération des données utilisateur:", error);
      return null;
    }
  }

  private async getDataFromAuriga(endpoint: string) {
    let headers: any = {};

    if (this.token) {
      headers = {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      };
    } else {
      headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://my.esme.fr",
        Referer: "https://my.esme.fr/",
        "X-Requested-With": "XMLHttpRequest",
      };

      if (this.cookie) {
        headers["Cookie"] = this.cookie;
        const xsrfMatch = this.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          headers["X-XSRF-TOKEN"] = xsrfMatch[1];
        }
      }
    }

    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "GET",
      headers: headers,
    });

    const data = await response.json();

    const contentType = response.headers.get("content-type");
    if (!response.ok || (contentType && contentType.includes("text/html"))) {
      console.error(`[AURIGA] | (Syllabus) Erreur API [${endpoint}] (${response.status}):`);
      throw new Error(`[AURIGA] | (Syllabus) Erreur API (${response.status}) on ${endpoint}`);
    }

    return data;
  }

  private mapSyllabusDetail(row: any, coeffs: Coeff[] = []): Syllabus | null {
    if (!row) {
      return null;
    }

    try {
      const fileName = row.documents?.[0]?.fileName || "";
      const syllabusCode = row.code || fileName.replace(/_(FR|EN)$/, "");

      const semesterMatch = syllabusCode.match(/_S(\d+)_/i);
      const semester = semesterMatch ? parseInt(semesterMatch[1], 10) : 0;

      const subjectCode = extractSubjectCode(syllabusCode);
      const ueCode = subjectCode.split("_")[0] || "Unknown";

      console.log(
        `[AURIGA] | (Syllabus) Code: "${syllabusCode}" -> Semester: ${semester}, UE: "${ueCode}", SubjectCode: "${subjectCode}"`
      );

      const coeff = coeffs.find((c) => c.name === syllabusCode);

      return {
        id: row.id,
        UE: ueCode,
        semester: semester,
        name: syllabusCode,
        code: row.field?.code,
        minScore: row.customAttributes?.miniScore,
        coeff: coeff ? coeff.value : undefined,
        duration: row.duration,
        period: {
          startDate: row.period?.startDate,
          endDate: row.period?.endDate,
        },
        exams:
          row.syllabusAssessmentComponents?.map((e: any, i: number) => ({
            id: e.id,
            index: e.index ?? i + 1,
            description: e.description,
            type: e.examType?.code,
            typeName: e.examType?.caption?.fr,
            weighting: e.weighting,
          })) || [],
        courseDescription: {
          coursPlan: row.customAttributes?.CoursePlan,
          expected: [],
        },
        caption: {
          name: row.caption?.fr,
          goals: row.outline?.fr ? { fr: row.outline.fr } : {},
          program: row.learningOutcome?.fr
            ? { fr: row.learningOutcome.fr }
            : {},
        },
        responsables:
          row.syllabusResponsibles?.map((r: any) => ({
            uid: r.person?.id,
            login: r.person?.customAttributes?.LOGIN,
            firstName: r.person?.currentFirstName,
            lastName: r.person?.currentLastName,
          })) || [],
        instructorsValidator: [],
        instructorsEditors: [],
        activities:
          row.syllabusActivityTypes?.map((a: any) => ({
            id: a.id,
            type: a.activityType?.code,
            typeName: a.activityType?.caption?.fr,
            duration: a.duration,
          })) || [],
        locations:
          row.syllabusSites?.map((s: any) => ({
            code: s.site?.code,
            name: s.site?.caption?.fr,
          })) || [],
      };
    } catch (e) {
      console.log("[AURIGA] | (Syllabus) Erreur lors du mapping du syllabus:", e);
      return null;
    }
  }
}

const api = new AurigaAPI();
export const API = api;
export default api;
