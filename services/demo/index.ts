/**
 * 🎭 DEMO MODE SERVICE
 *
 * Credentials: admin@admin.com / admin1
 *
 * Ce service génère des données fictives pour le compte démo
 * utilisé par les reviewers Google Play / App Store.
 * Aucune vraie requête réseau n'est effectuée.
 */

import {
  addPeriodsToDatabase,
  addPeriodGradesToDatabase,
} from "@/database/useGrades";
import { addSyllabusToDatabase } from "@/database/useSyllabus";
import { saveIntracomEventsToDatabase, IntracomEventData } from "@/database/useIntracomEvents";
import { Period, PeriodGrades, Subject, Grade } from "@/services/shared/grade";
import { Syllabus } from "@/services/auriga/types";
import { MMKV } from "react-native-mmkv";

export const DEMO_EMAIL = "admin@admin.com";
export const DEMO_PASSWORD = "admin1";
export const DEMO_ACCOUNT_ID = "demo-account-chrysalide-2024";

// Storage for Absences service (mirrors the keys used in services/absences/index.ts)
const absencesStorage = new MMKV({ id: "absences-storage" });

// ─── Helpers ────────────────────────────────────────────────────────────────

function rand(min: number, max: number, decimals = 1): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── Demo Periods ────────────────────────────────────────────────────────────

function buildDemoPeriods(): Period[] {
  return [
    {
      name: "Semestre 1",
      createdByAccount: DEMO_ACCOUNT_ID,
      start: new Date("2024-09-02"),
      end: new Date("2025-01-31"),
    },
    {
      name: "Semestre 2",
      createdByAccount: DEMO_ACCOUNT_ID,
      start: new Date("2025-02-03"),
      end: new Date("2025-06-20"),
    },
  ];
}

// ─── Demo Grades ─────────────────────────────────────────────────────────────

interface SubjectDef {
  id: string;
  name: string;
  gradeCount: number;
}

const DEMO_SUBJECTS: SubjectDef[] = [
  { id: "algo", name: "Algorithmique", gradeCount: 3 },
  { id: "maths", name: "Mathématiques", gradeCount: 4 },
  { id: "sys", name: "Systèmes d'exploitation", gradeCount: 2 },
  { id: "prog", name: "Programmation orientée objet", gradeCount: 3 },
  { id: "net", name: "Réseaux & Protocoles", gradeCount: 2 },
  { id: "eng", name: "Anglais", gradeCount: 2 },
  { id: "elec", name: "Électronique", gradeCount: 2 },
  { id: "prob", name: "Probabilités & Statistiques", gradeCount: 3 },
];

function buildDemoGrades(periodName: string): PeriodGrades {
  const subjects: Subject[] = DEMO_SUBJECTS.map((def) => {
    const grades: Grade[] = Array.from({ length: def.gradeCount }, (_, i) => {
      const score = rand(6, 19);
      return {
        id: `${def.id}-grade-${i}-${periodName}`,
        subjectId: def.id,
        subjectName: def.name,
        description: i === 0 ? "Contrôle continu" : i === 1 ? "TP noté" : "Examen final",
        givenAt: daysAgo(randInt(5, 90)),
        outOf: { value: 20 },
        coefficient: i === def.gradeCount - 1 ? 2 : 1,
        studentScore: { value: score },
        averageScore: { value: rand(8, 16) },
        createdByAccount: DEMO_ACCOUNT_ID,
      };
    });

    const avg =
      grades.reduce((acc, g) => acc + (g.studentScore?.value ?? 0) * g.coefficient, 0) /
      grades.reduce((acc, g) => acc + g.coefficient, 0);

    return {
      id: def.id,
      name: def.name,
      studentAverage: { value: parseFloat(avg.toFixed(2)) },
      classAverage: { value: rand(9, 14) },
      outOf: { value: 20 },
      grades,
    };
  });

  const overallAvg =
    subjects.reduce((acc, s) => acc + s.studentAverage.value, 0) / subjects.length;

  return {
    createdByAccount: DEMO_ACCOUNT_ID,
    studentOverall: { value: parseFloat(overallAvg.toFixed(2)) },
    classAverage: { value: rand(10, 13) },
    subjects,
  };
}

// ─── Demo Syllabus ────────────────────────────────────────────────────────────

function buildDemoSyllabus(): Syllabus[] {
  return DEMO_SUBJECTS.map((def, index) => ({
    id: index + 1,
    UE: `UE${Math.floor(index / 2) + 1}`,
    semester: 1,
    name: def.name,
    code: def.id.toUpperCase(),
    minScore: 8,
    duration: 30,
    period: {
      startDate: "2024-09-02",
      endDate: "2025-01-31",
    },
    exams: [
      {
        id: index * 10 + 1,
        index: 0,
        description: { fr: "Contrôle continu", en: "Continuous assessment" },
        type: "CC",
        typeName: "Contrôle continu",
        weighting: 0.4,
      },
      {
        id: index * 10 + 2,
        index: 1,
        description: { fr: "Examen final", en: "Final exam" },
        type: "EX",
        typeName: "Examen",
        weighting: 0.6,
      },
    ],
    courseDescription: {
      coursPlan: {
        fr: `Plan du cours de ${def.name}. Ce module couvre les concepts fondamentaux et les applications pratiques.`,
        en: `Course plan for ${def.name}. This module covers fundamental concepts and practical applications.`,
      },
      expected: [
        { fr: "Maîtriser les bases du module", en: "Master the basics of the module" },
        { fr: "Appliquer les techniques avancées", en: "Apply advanced techniques" },
      ],
    },
    caption: {
      name: def.name,
      goals: {
        fr: `Objectifs du module ${def.name}`,
        en: `Goals of ${def.name} module`,
      },
      program: {
        fr: `Programme du module ${def.name}`,
        en: `Program of ${def.name} module`,
      },
    },
    responsables: [
      {
        uid: index + 100,
        login: `prof.${def.id}`,
        lastName: ["Dupont", "Martin", "Bernard", "Laurent", "Moreau"][index % 5],
        firstName: ["Jean", "Marie", "Pierre", "Sophie", "Lucas"][index % 5],
      },
    ],
    instructorsValidator: [],
    instructorsEditors: [],
    activities: [
      { id: index * 100 + 1, type: "CM", typeName: "Cours magistral", duration: 20 },
      { id: index * 100 + 2, type: "TD", typeName: "Travaux dirigés", duration: 10 },
    ],
    locations: [
      { code: `BAT${randInt(1, 15)}`, name: `Bâtiment ${randInt(1, 15)} - Salle ${randInt(100, 220)}` },
    ],
  }));
}

// ─── Demo Intracom Events ─────────────────────────────────────────────────────

const INTRACOM_TYPES = ["Conférence", "Hackathon", "Workshop", "Tournoi", "Afterwork", "Visite entreprise"];
const INTRACOM_NAMES = [
  "Conférence IA & Machine Learning",
  "Hackathon 24h EPITA",
  "Workshop Cybersécurité",
  "Tournoi de Ping-Pong Inter-Promo",
  "Afterwork Networking Alumni",
  "Visite Google France",
  "Conférence Blockchain & Web3",
  "Workshop Docker & Kubernetes",
  "Hackathon Green Tech",
  "Afterwork Jeux de Société",
  "Conférence Entrepreneuriat",
  "Workshop React Native",
];
const CAMPUS_SLUGS = ["paris-le-kremlin-bicetre", "paris-villejuif", "lyon", "rennes", "toulouse"];
const CITIES = ["Le Kremlin-Bicêtre", "Villejuif", "Lyon", "Rennes", "Toulouse"];
const ADDRESSES = [
  "14 Rue Voltaire",
  "9 Rue d'Ivry",
  "156 Boulevard de la Croix-Rousse",
  "2 Rue du Thabor",
  "8 Esplanade Compans Caffarelli",
];

function buildDemoIntracomEvents(): IntracomEventData[] {
  return INTRACOM_NAMES.map((name, i) => {
    const campusIndex = i % CAMPUS_SLUGS.length;
    const eventDate = i < 6 ? daysFromNow(i * 7 + 1) : daysAgo((i - 6) * 14 + 3);
    return {
      id: 10000 + i,
      date: eventDate.toISOString().split("T")[0],
      type: INTRACOM_TYPES[i % INTRACOM_TYPES.length],
      name,
      campusSlug: CAMPUS_SLUGS[campusIndex],
      registeredStudents: randInt(10, 80),
      nbNewStudents: randInt(2, 15),
      maxStudents: randInt(80, 150),
      state: i < 6 ? "OPEN" : "CLOSED",
      address: ADDRESSES[campusIndex],
      town: CITIES[campusIndex],
      bonus: i % 3 === 0 ? rand(0.1, 0.5, 1) : undefined,
    };
  });
}

// ─── Demo Absences (EPITA Absence via MMKV) ───────────────────────────────────
// We seed directly into MMKV because the attendance WatermelonDB table requires
// schema-specific fields (levelId, semesterId) not present in SharedAttendance.
// The EPITA Absence service (services/absences/index.ts) reads from MMKV directly.

const SUBJECTS_FOR_ABSENCES = [
  "Algorithmique",
  "Mathématiques",
  "Systèmes d'exploitation",
  "Anglais",
  "Programmation orientée objet",
];

function seedDemoAbsencesMMKV(): void {
  const absenceCount = randInt(2, 5);
  const absences = Array.from({ length: absenceCount }, (_, i) => ({
    slotId: randInt(1000, 9999),
    startDate: daysAgo(randInt(3, 60)).toISOString(),
    subjectName: SUBJECTS_FOR_ABSENCES[i % SUBJECTS_FOR_ABSENCES.length],
    justificatory: i % 2 === 0 ? "Justifié" : "",
    mandatory: true,
  }));

  const rawPayload = [
    {
      levelId: 1,
      levelName: "ING1",
      semesterId: 1,
      periods: [
        {
          periodId: 1,
          name: "Semestre 1",
          beginDate: "2024-09-02T00:00:00.000Z",
          endDate: "2025-01-31T00:00:00.000Z",
          absences,
        },
      ],
    },
  ];

  absencesStorage.set("absences_grades", JSON.stringify(rawPayload));
  absencesStorage.set("AbsencesNumber", absenceCount);
  absencesStorage.set("absences_token", "DEMO_TOKEN_NOT_REAL");
}

// ─── Main seeder ─────────────────────────────────────────────────────────────

/**
 * Seeds all demo data into the local databases.
 * Called after creating the demo account in `aurigaAuth.tsx`.
 */
export async function seedDemoData(accountId: string): Promise<void> {
  // 1. Periods
  const periods = buildDemoPeriods();
  await addPeriodsToDatabase(periods);

  // 2. Grades for each period
  for (const period of periods) {
    const grades = buildDemoGrades(period.name);
    await addPeriodGradesToDatabase(grades, period.name);
  }

  // 3. Syllabus
  const syllabus = buildDemoSyllabus();
  await addSyllabusToDatabase(syllabus);

  // 4. Intracom events
  const events = buildDemoIntracomEvents();
  await saveIntracomEventsToDatabase(events, accountId);

  // 5. Absences — seeded via MMKV only (no WatermelonDB for EPITA absences)
  seedDemoAbsencesMMKV();
}

/**
 * Returns whether the given credentials match the demo account.
 */
export function isDemoCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL &&
    password.trim() === DEMO_PASSWORD
  );
}
