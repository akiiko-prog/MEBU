import { Model, Q } from "@nozbe/watermelondb";

import { Syllabus } from "@/services/auriga/types";
import { warn } from "@/utils/logger/logger";

import { getDatabaseInstance } from "./DatabaseProvider";
import SyllabusModel from "./models/Syllabus";
import { safeWrite } from "./utils/safeTransaction";

export async function addSyllabusToDatabase(syllabusList: Syllabus[]) {
  const db = getDatabaseInstance();

  await safeWrite(
    db,
    async () => {
      // Clear existing syllabus entries and replace with fresh data
      const existing = await db.get("syllabus").query().fetch();
      for (const record of existing) {
        await record.destroyPermanently();
      }

      for (const item of syllabusList) {
        await db.get("syllabus").create((record: Model) => {
          const syllabus = record as SyllabusModel;
          Object.assign(syllabus, {
            syllabusId: String(item.id),
            data: JSON.stringify(item),
          });
        });
      }
    },
    10000,
    "addSyllabusToDatabase"
  );
}

export async function getSyllabusFromCache(): Promise<Syllabus[]> {
  try {
    const db = getDatabaseInstance();
    const records = await db.get<SyllabusModel>("syllabus").query().fetch();

    return records
      .map((record) => {
        try {
          return JSON.parse(record.data) as Syllabus;
        } catch {
          return null;
        }
      })
      .filter((s): s is Syllabus => s !== null);
  } catch (e) {
    warn(String(e));
    return [];
  }
}
