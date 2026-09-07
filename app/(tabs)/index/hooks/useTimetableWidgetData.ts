import { useEffect, useMemo, useState } from "react";
import { Q } from "@nozbe/watermelondb";

import { useDatabase } from "@/database/DatabaseProvider";
import { mapCourseToShared } from "@/database/mappers/course";
import Course from "@/database/models/Timetable";
import { Course as SharedCourse } from "@/services/shared/timetable";
import { useAccountStore } from "@/stores/account";
import { getSubjectName } from "@/utils/subjects/name";
import { syncNextCourseToWidget } from "@/utils/widget/syncCourse";

/** Formate une date en label lisible pour le widget : "Aujourd'hui", "Demain", ou "Lun. 10 mars" */
function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  if (dayStart.getTime() === today.getTime()) return "Aujourd'hui";
  if (dayStart.getTime() === tomorrow.getTime()) return "Demain";
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export const useTimetableWidgetData = () => {
  const database = useDatabase();

  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);
  const account = accounts.find((a) => a.id === lastUsedAccount);

  const services = useMemo(() =>
    account?.services?.map((service: { id: string }) => service.id) ?? [],
    [account?.services]
  );

  const [courses, setCourses] = useState<SharedCourse[]>([]);

  useEffect(() => {
    const fetchNextCourses = async () => {
      try {
        const now = Date.now();

        const rawCourses = await database
          .get<Course>("courses")
          .query(
            Q.where("to", Q.gt(now)),
            Q.sortBy("from", Q.asc)
          )
          .fetch();

        const filtered = rawCourses.filter(c =>
          services.includes(c.createdByAccount) || c.createdByAccount.startsWith("ical_")
        );

        const mapped = filtered.map(mapCourseToShared);

        if (mapped.length > 0) {
          const firstDay = new Date(mapped[0].from);
          firstDay.setHours(0, 0, 0, 0);
          const nextDayEnd = new Date(firstDay);
          nextDayEnd.setDate(nextDayEnd.getDate() + 1);

          const dayOnlyCourses = mapped.filter(c =>
            c.from.getTime() >= firstDay.getTime() &&
            c.from.getTime() < nextDayEnd.getTime()
          );
          setCourses(dayOnlyCourses);
        } else {
          setCourses([]);
        }
      } catch (e) {
        console.warn("[useTimetableWidgetData] Failed to fetch next courses:", e);
        setCourses([]);
      }
    };

    fetchNextCourses();

    const subscription = database.get("courses").query().observe().subscribe(() => {
      fetchNextCourses();
    });

    return () => subscription.unsubscribe();
  }, [database, services.join(",")]);

  useEffect(() => {
    if (courses.length > 0) {
      const nextCourse = courses[0];
      const from = nextCourse.from;
      const to = nextCourse.to;
      const timeStr = `${from.getHours().toString().padStart(2, "0")}h${from.getMinutes().toString().padStart(2, "0")} – ${to.getHours().toString().padStart(2, "0")}h${to.getMinutes().toString().padStart(2, "0")}`;
      const dateLabel = formatDayLabel(from);
      syncNextCourseToWidget(getSubjectName(nextCourse.subject), nextCourse.room ?? "", timeStr, dateLabel);
    } else {
      syncNextCourseToWidget("Aucun cours", "", "", "");
    }
  }, [courses]);

  return { courses };
};
