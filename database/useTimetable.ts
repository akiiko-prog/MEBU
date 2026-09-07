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

  useEffect(() => {
    const fetchTimetable = async () => {
      const timetableFetched = await getCoursesFromCache(weeks);
      setTimetable(timetableFetched);
    };
    fetchTimetable();
  }, [refresh, database, weeksKey]);

  useEffect(() => {
    const icalQuery = database.get('icals').query();
    const subscription = icalQuery.observe().subscribe(() => {
      const fetchTimetable = async () => {
        const timetableFetched = await getCoursesFromCache(weeks);
        setTimetable(timetableFetched);
      };
      fetchTimetable();
    });
    return () => subscription.unsubscribe();
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

export async function addCourseDayToDatabase(courses: SharedCourseDay[]) {
  const db = getDatabaseInstance();
  await safeWrite(
    db,
    async () => {
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

        for (const item of day.courses) {
          const oldId = generateId(item.from.toISOString() + item.to.toISOString() + item.subject + item.teacher + item.room + item.createdByAccount);
          const id = generateId(item.from.toISOString() + item.to.toISOString() + item.subject + item.teacher + item.createdByAccount);
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

          const fallbackRecord = existingRecords.length === 0
            ? dbCourses.find(dbCourse =>
              getStableCourseKey({
                from: dbCourse.from,
                to: dbCourse.to,
                createdByAccount: dbCourse.createdByAccount,
                kidName: dbCourse.kidName,
              }) === stableKey
            )
            : undefined;

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

            let newStatus = item.status ?? courseToUpdate.status;

            if (item.cancel === true) {
              if (courseToUpdate.status !== CourseStatus.CANCELED) {
                newStatus = CourseStatus.CANCELED;
                sendCancelCourseNotification(courseToUpdate.subject);
              } else {
                newStatus = CourseStatus.CANCELED;
              }
            } else if (courseToUpdate.status === CourseStatus.CANCELED && (item.status === undefined || item.status === null)) {
              newStatus = hasChanged ? CourseStatus.EDITED : undefined;
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