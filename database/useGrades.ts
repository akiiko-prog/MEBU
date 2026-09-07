import { Model, Q } from "@nozbe/watermelondb";

import {
  Period as SharedPeriod,
  PeriodGrades as SharedPeriodGrades,
} from "@/services/shared/grade";
import { generateId } from "@/utils/generateId";
import { warn } from "@/utils/logger/logger";

import { getDatabaseInstance } from "./DatabaseProvider";
import { mapPeriodToShared } from "./mappers/grade";
import { Period, PeriodGrades } from "./models/Grades";
import { safeWrite } from "./utils/safeTransaction";

export async function addPeriodsToDatabase(periods: SharedPeriod[]) {
  const db = getDatabaseInstance();

  await safeWrite(
    db,
    async () => {
      const existing = await db.get("periods").query().fetch();
      for (const record of existing) {
        await record.destroyPermanently();
      }

      for (const item of periods) {
        const id = generateId(item.name + item.createdByAccount);
        await db.get("periods").create((record: Model) => {
          const period = record as Period;
          Object.assign(period, {
            periodId: id,
            name: item.name,
            createdByAccount: item.createdByAccount,
            start: item.start.getTime(),
            end: item.end.getTime(),
          });
        });
      }
    },
    10000,
    "addPeriodsToDatabase"
  );
}

export async function getPeriodsFromCache(): Promise<SharedPeriod[]> {
  try {
    const database = getDatabaseInstance();
    const period = await database.get<Period>("periods").query().fetch();

    return period
      .map(mapPeriodToShared)
      .sort((a, b) => a.end.getTime() - b.end.getTime());
  } catch (e) {
    warn(String(e));
    return [];
  }
}

export async function addPeriodGradesToDatabase(
  item: SharedPeriodGrades,
  period: string
) {
  const db = getDatabaseInstance();
  const id = generateId(period + item.createdByAccount);

  const serializedData = JSON.stringify(item, (_key, value) => {
    if (value instanceof Date) {
      return { __date: value.toISOString() };
    }
    return value;
  });

  await safeWrite(
    db,
    async () => {
      // Remove all existing periodgrades for this period+account, then recreate
      const allExisting = await db
        .get("periodgrades")
        .query(Q.where("periodGradeId", id))
        .fetch();

      for (const record of allExisting) {
        await record.destroyPermanently();
      }

      await db.get("periodgrades").create((record: Model) => {
        const periodGrade = record as PeriodGrades;
        Object.assign(periodGrade, {
          periodGradeId: id,
          createdByAccount: item.createdByAccount,
          studentOverallRaw: JSON.stringify(item.studentOverall),
          classAverageRaw: JSON.stringify(item.classAverage),
          data: serializedData,
        });
      });
    },
    10000,
    "addPeriodGradesToDatabase"
  );
}

export async function cleanOrphanedPeriodGrades() {
  const db = getDatabaseInstance();

  await safeWrite(
    db,
    async () => {
      const periods = await db.get<Period>("periods").query().fetch();
      const periodGrades = await db.get<PeriodGrades>("periodgrades").query().fetch();

      const validIds = new Set(
        periods.map(p => generateId(p.name + p.createdByAccount))
      );

      for (const pg of periodGrades) {
        if (!validIds.has(pg.periodGradeId)) {
          await pg.destroyPermanently();
        }
      }
    },
    10000,
    "cleanOrphanedPeriodGrades"
  );
}

export async function getGradePeriodsFromCache(
  period: string,
  createdByAccount?: string
): Promise<SharedPeriodGrades> {
  try {
    const database = getDatabaseInstance();

    let pg: PeriodGrades | null = null;

    if (createdByAccount) {
      const id = generateId(period + createdByAccount);
      const results = await database
        .get<PeriodGrades>("periodgrades")
        .query(Q.where("periodGradeId", id))
        .fetch();
      if (results.length > 0) {
        pg = results[0];
      }
    }

    if (!pg) {
      const allPeriodGrades = await database
        .get<PeriodGrades>("periodgrades")
        .query()
        .fetch();
      if (allPeriodGrades.length > 0) {
        pg = allPeriodGrades[0];
      }
    }

    if (pg?.data) {
      try {
        return JSON.parse(pg.data, (_key, value) => {
          if (value && typeof value === "object" && value.__date) {
            return new Date(value.__date);
          }
          return value;
        }) as SharedPeriodGrades;
      } catch {
        warn("Failed to parse cached period grades data");
      }
    }

    return {
      studentOverall: pg?.studentOverall ?? { value: 0, disabled: true },
      classAverage: pg?.classAverage ?? { value: 0, disabled: true },
      subjects: [],
      createdByAccount: pg?.createdByAccount ?? "",
    };
  } catch (e) {
    warn(String(e));
    return {
      studentOverall: { value: 0, disabled: true },
      classAverage: { value: 0, disabled: true },
      subjects: [],
      createdByAccount: "",
    };
  }
}
