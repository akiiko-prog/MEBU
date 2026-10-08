import { Model, Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import { getICalEventsForWeek } from "@/services/local/ical";
import { Course as SharedCourse, CourseDay as SharedCourseDay, CourseStatus } from "@/services/shared/timetable"
import { generateId } from "@/utils/generateId";
import { warn } from "@/utils/logger/logger";

import { getDatabaseInstance, useDatabase } from "./DatabaseProvider"
import { mapCourseToShared } from "./mappers/course";
import Course from "./models/Timetable";
import { getDateRangeOfWeek } from "./useHomework";
import { safeWrite } from "./utils/safeTransaction";
import { sendCancelCourseNotification, sendEditCourseNotification } from "@/utils/notification/alertNotification";

export function useTimetable(refresh = 0, weekNumber: number | number[] = 0) {
  const database = useDatabase();
  const [timetable, setTimetable] = useState<SharedCourseDay[]>([]);

  const weeks = Array.isArray(weekNumber) ? weekNumber : [weekNumber];
  const weeksKey = weeks.join(',');

  // En faisant défiler vite le calendrier, plusieurs lectures sont en vol en
  // même temps et peuvent se terminer dans le désordre : on ignore le résultat
  // d'une lecture dès que les semaines demandées ont changé, sinon une vieille
  // semaine (souvent vide) remplace celle affichée.
  useEffect(() => {
    let cancelled = false;
    getCoursesFromCache(weeks).then((timetableFetched) => {
      if (!cancelled) setTimetable(timetableFetched);
    });
    return () => { cancelled = true; };
  }, [refresh, database, weeksKey]);

  useEffect(() => {
    let cancelled = false;
    const icalQuery = database.get('icals').query();
    const subscription = icalQuery.observe().subscribe(() => {
      getCoursesFromCache(weeks).then((timetableFetched) => {
        if (!cancelled) setTimetable(timetableFetched);
      });
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [database, weeksKey]);

  return timetable;
}

function normalizedValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function toIsoValue(value: Date | number): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function getStableCourseKey(input: {
  from: Date | number;
  to: Date | number;
  createdByAccount: string;
  kidName?: string | null;
}): string {
  return `${toIsoValue(input.from)}|${toIsoValue(input.to)}|${input.createdByAccount}|${normalizedValue(input.kidName)}`;
}

/**
 * @param syncRange Période couverte par la récupération. Si fournie, les cours
 * du même compte présents en base sur cette période mais absents de `courses`
 * sont supprimés (cours déplacés ou retirés de l'emploi du temps).
 */
export async function addCourseDayToDatabase(
  courses: SharedCourseDay[],
  syncRange?: { from: Date; to: Date },
) {
  const db = getDatabaseInstance();
  await safeWrite(
    db,
    async () => {
      const syncedIds = new Set<string>();

      for (const day of courses) {
        if (day.courses.length === 0) continue;

        const dayTimestamp = day.date.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const accountIds = Array.from(new Set(day.courses.map(c => c.createdByAccount)));

        const dbCourses = await db.get<Course>('courses')
          .query(
            Q.where('from', Q.between(dayTimestamp, dayTimestamp + oneDayMs)),
            Q.where('createdByAccount', Q.oneOf(accountIds))
          )
          .fetch();

        // Identifiants de tous les cours reçus pour ce jour : un enregistrement
        // qui porte l'un d'eux appartient déjà à un autre cours du lot
        const dayIds = new Set(day.courses.map(c =>
          generateId(c.from.toISOString() + c.to.toISOString() + c.subject + c.teacher + c.createdByAccount)
        ));
        const claimedRecords = new Set<string>();

        for (const item of day.courses) {
          // Cours relu depuis la base (ex : Auriga sert l'EDT depuis le cache) :
          // le réécrire écraserait un statut plus récent posé par la synchro
          if (item.fromCache) continue;

          const oldId = generateId(item.from.toISOString() + item.to.toISOString() + item.subject + item.teacher + item.room + item.createdByAccount);
          const id = generateId(item.from.toISOString() + item.to.toISOString() + item.subject + item.teacher + item.createdByAccount);
          syncedIds.add(id);
          const stableKey = getStableCourseKey({
            from: item.from,
            to: item.to,
            createdByAccount: item.createdByAccount,
            kidName: item.kidName,
          });

          const oldExistingRecords = await db.get<Course>('courses')
            .query(Q.where('courseId', oldId))
            .fetch();

          const existingRecords = await db.get<Course>('courses')
            .query(Q.where('courseId', id))
            .fetch();

          for (const oldRecord of oldExistingRecords) {
            if (oldRecord.courseId !== id) {
              await oldRecord.markAsDeleted();
            }
          }

          // Repli sur le même créneau (ex : prof changé) uniquement pour un
          // enregistrement orphelin : sans ça, deux cours en parallèle (options,
          // groupes) se transformaient l'un en l'autre à chaque synchro, l'un
          // disparaissait et l'autre restait marqué "modifié"
          const fallbackRecord = existingRecords.length === 0
            ? dbCourses.find(dbCourse =>
              !dayIds.has(dbCourse.courseId) &&
              !claimedRecords.has(dbCourse.id) &&
              getStableCourseKey({
                from: dbCourse.from,
                to: dbCourse.to,
                createdByAccount: dbCourse.createdByAccount,
                kidName: dbCourse.kidName,
              }) === stableKey
            )
            : undefined;
          if (fallbackRecord) claimedRecords.add(fallbackRecord.id);

          const courseToUpdate = (existingRecords[0] as Course | undefined) ?? (fallbackRecord as Course | undefined);

          if (!courseToUpdate) {
            await db.get('courses').create((record: Model) => {
              const course = record as Course;
              Object.assign(course, {
                createdByAccount: item.createdByAccount,
                courseId: id,
                subject: item.subject,
                type: item.type,
                from: item.from.getTime(),
                to: item.to.getTime(),
                additionalInfo: item.additionalInfo,
                room: item.room,
                teacher: item.teacher,
                group: item.group,
                backgroundColor: item.backgroundColor,
                status: item.cancel ? CourseStatus.CANCELED : item.status == CourseStatus.TD ? CourseStatus.TD : item.status == CourseStatus.CM ? CourseStatus.CM : item.status == CourseStatus.EVALUATED ? CourseStatus.EVALUATED : undefined,
                customStatus: item.customStatus,
                url: item.url,
                kidName: item.kidName,
              });
            });
          } else {
            const safeCmp = (a: any, b: any) => (a ?? "") !== (b ?? "");
            const hasChanged =
              safeCmp(item.subject, courseToUpdate.subject) ||
              safeCmp(item.teacher, courseToUpdate.teacher) ||
              safeCmp(item.room, courseToUpdate.room) ||
              safeCmp(item.group, courseToUpdate.group) ||
              safeCmp(item.additionalInfo, courseToUpdate.additionalInfo) ||
              safeCmp(item.type, courseToUpdate.type);

            // Le statut suit la source à chaque synchro : "modifié" ne reste pas
            // collé au cours une fois le changement passé
            let newStatus = item.status;

            if (item.cancel === true) {
              if (courseToUpdate.status !== CourseStatus.CANCELED) {
                sendCancelCourseNotification(courseToUpdate.subject);
              }
              newStatus = CourseStatus.CANCELED;
            } else if (hasChanged && (item.status === undefined || item.status === null)) {
              newStatus = CourseStatus.EDITED;
            }

            const shouldUpdate =
              hasChanged ||
              newStatus !== courseToUpdate.status ||
              safeCmp(item.url, courseToUpdate.url) ||
              safeCmp(item.kidName, courseToUpdate.kidName) ||
              safeCmp(item.customStatus, courseToUpdate.customStatus) ||
              safeCmp(item.backgroundColor, courseToUpdate.backgroundColor);

            if (shouldUpdate) {
              if (newStatus === CourseStatus.EDITED) {
                sendEditCourseNotification(courseToUpdate.subject);
              }
              await courseToUpdate.update((model: Model) => {
                const course = model as Course;
                Object.assign(course, {
                  courseId: id,
                  subject: item.subject ?? course.subject,
                  type: item.type ?? course.type,
                  from: item.from.getTime(),
                  to: item.to.getTime(),
                  additionalInfo: item.additionalInfo ?? course.additionalInfo,
                  room: item.room ?? course.room,
                  teacher: item.teacher ?? course.teacher,
                  group: item.group ?? course.group,
                  backgroundColor: item.backgroundColor ?? course.backgroundColor,
                  status: newStatus,
                  customStatus: item.customStatus ?? course.customStatus,
                  url: item.url ?? course.url,
                  kidName: item.kidName ?? course.kidName,
                });
              });
            }
          }
        }
      }

      if (syncRange) {
        const accountIds = Array.from(new Set(
          courses.flatMap(day => day.courses.map(c => c.createdByAccount))
        ));
        if (accountIds.length > 0) {
          const staleCourses = await db.get<Course>('courses')
            .query(
              Q.where('from', Q.between(syncRange.from.getTime(), syncRange.to.getTime())),
              Q.where('createdByAccount', Q.oneOf(accountIds))
            )
            .fetch();
          for (const stale of staleCourses) {
            if (!syncedIds.has(stale.courseId)) {
              await stale.destroyPermanently();
            }
          }
        }
      }
    },
    15000,
    `add_timetable_${courses.length}_days`
  );
}

export async function getCoursesFromCache(weeks: number[]): Promise<SharedCourseDay[]> {
  try {
    const database = getDatabaseInstance();

    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);

    for (const w of weeks) {
      const { start, end } = getDateRangeOfWeek(w);
      if (start < minStart) { minStart = start; }
      if (end > maxEnd) { maxEnd = end; }
    }

    const courses = await database
      .get<Course>('courses')
      .query(Q.where('from', Q.between(minStart.getTime(), maxEnd.getTime())))
      .fetch();

    const dayMap: Record<string, SharedCourse[]> = {};
    for (const course of courses) {
      const dayKey = new Date(course.from).toISOString().split("T")[0];
      dayMap[dayKey] = dayMap[dayKey] || [];
      dayMap[dayKey].push(mapCourseToShared(course));
    }

    try {
      const icalEvents = await getICalEventsForWeek(minStart, maxEnd);
      for (const event of icalEvents) {
        const dayKey = new Date(event.from).toISOString().split("T")[0];
        dayMap[dayKey] = dayMap[dayKey] || [];
        dayMap[dayKey].push(event);
      }
    } catch (icalError) {
      console.warn('Error loading iCal events:', icalError);
    }

    for (const day in dayMap) {
      dayMap[day].sort((a, b) => a.from.getTime() - b.from.getTime());
    }

    return Object.entries(dayMap).map(([day, courses]) => ({
      date: new Date(day),
      courses
    }));
  } catch (e) {
    warn(String(e));
    return [];
  }
}