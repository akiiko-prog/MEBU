import { useCallback, useEffect } from 'react';

import { Q } from '@nozbe/watermelondb';
import { getDatabaseInstance } from '@/database/DatabaseProvider';
import { getWeekNumberFromDate } from '@/database/useHomework';
import { getGradePeriodsFromCache, getPeriodsFromCache } from '@/database/useGrades';
import { getManager, initializeAccountManager } from "@/services/shared";
import { Grade as SharedGrade } from '@/services/shared/grade';
import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';
import { useAlert } from '@/ui/components/AlertProvider';
import { getCurrentPeriod } from '@/utils/grades/helper/period';
import { log, warn } from '@/utils/logger/logger';
import { getSubjectName } from '@/utils/subjects/name';
import PapillonSubjectAvg from "@/utils/grades/algorithms/subject";
import { syncGradesToWidget } from '@/utils/widget/syncGrades';
import { syncNextCourseToWidget } from '@/utils/widget/syncCourse';
import { mapCourseToShared } from '@/database/mappers/course';
import Course from '@/database/models/Timetable';
import { useTranslation } from 'react-i18next';

export const useHomeData = () => {
  const alert = useAlert();
  const settingsstore = useSettingsStore(state => state.personalization);
  const { t } = useTranslation();

  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);
  const account = accounts.find((a) => a.id === lastUsedAccount);
  const services = account?.services?.map((s: { id: string }) => s.id) ?? [];

  const syncTimetableToWidget = useCallback(async () => {
    try {
      const db = getDatabaseInstance();
      const now = Date.now();

      const rawCourses = await db
        .get<Course>('courses')
        .query(Q.where('to', Q.gt(now)), Q.sortBy('from', Q.asc))
        .fetch();

      const filtered = rawCourses.filter(c =>
        services.includes(c.createdByAccount) || c.createdByAccount.startsWith('ical_')
      );

      if (filtered.length > 0) {
        const next = mapCourseToShared(filtered[0]);
        const from = next.from;
        const to = next.to;
        const timeStr = `${from.getHours().toString().padStart(2, '0')}h${from.getMinutes().toString().padStart(2, '0')} – ${to.getHours().toString().padStart(2, '0')}h${to.getMinutes().toString().padStart(2, '0')}`;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const fromDay = new Date(from); fromDay.setHours(0, 0, 0, 0);
        const dateLabel = fromDay.getTime() === today.getTime() ? "Aujourd'hui"
          : fromDay.getTime() === tomorrow.getTime() ? 'Demain'
            : from.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        syncNextCourseToWidget(getSubjectName(next.subject), next.room ?? '', timeStr, dateLabel);
      } else {
        syncNextCourseToWidget('Aucun cours', '', '', '');
      }
    } catch (e) {
      warn(`[useHomeData] syncTimetableToWidget failed: ${e}`);
    }
  }, [services.join(',')]);

  const syncGradesFromCache = useCallback(async () => {
    try {
      const periods = await getPeriodsFromCache();
      const currentPeriod = getCurrentPeriod(periods);
      if (!currentPeriod) return;

      const periodGrades = await getGradePeriodsFromCache(
        currentPeriod.name,
        currentPeriod.createdByAccount
      );

      const allGrades: (SharedGrade & { subjectDisplayName: string })[] = [];
      for (const subject of periodGrades.subjects ?? []) {
        for (const grade of subject.grades ?? []) {
          if (grade.studentScore?.value !== undefined && !isNaN(grade.studentScore.value) && !grade.studentScore.disabled) {
            allGrades.push({ ...grade, subjectDisplayName: subject.name });
          }
        }
        for (const mod of subject.subjects ?? []) {
          for (const grade of mod.grades ?? []) {
            if (grade.studentScore?.value !== undefined && !isNaN(grade.studentScore.value) && !grade.studentScore.disabled) {
              allGrades.push({ ...grade, subjectDisplayName: mod.name });
            }
          }
        }
      }

      const safeTime = (d: Date | string | undefined | null): number => {
        if (!d) return 0;
        if (d instanceof Date) return d.getTime();
        const p = new Date(d);
        return isNaN(p.getTime()) ? 0 : p.getTime();
      };
      allGrades.sort((a, b) => safeTime(b.givenAt) - safeTime(a.givenAt));

      if (allGrades.length === 0) return;

      const latestGrades = allGrades.slice(0, 5).map(g => ({
        subject: getSubjectName(g.subjectDisplayName),
        value: g.studentScore!.value!,
        outOf: g.outOf?.value ?? 20,
        date: g.givenAt instanceof Date ? g.givenAt.toISOString() : (g.givenAt ? new Date(g.givenAt).toISOString() : new Date().toISOString()),
      }));

      const average = periodGrades.studentOverall?.value ?? PapillonSubjectAvg(allGrades);

      await syncGradesToWidget({ average, latestGrades, averageHistory: [] });
      log(`[useHomeData] Grades widget synced. Average: ${average.toFixed(2)}`);
    } catch (e) {
      warn(`[useHomeData] syncGradesFromCache failed: ${e}`);
    }
  }, []);

  const fetchEDT = useCallback(async () => {
    const manager = getManager();
    const date = new Date();
    const weekNumber = getWeekNumberFromDate(date);
    await manager.getWeeklyTimetable(weekNumber);
    await syncTimetableToWidget();
  }, [syncTimetableToWidget]);

  const fetchGrades = useCallback(async () => {
    const manager = getManager();
    if (!manager) {
      warn('Manager is null, skipping grades fetch');
      return;
    }
    const gradePeriods = await manager.getGradesPeriods();
    if (!gradePeriods) { return; }

    const currentPeriod = getCurrentPeriod(gradePeriods);

    if (currentPeriod) {
      await manager.getGradesForPeriod(currentPeriod, currentPeriod.createdByAccount);
    }

    await syncGradesFromCache();
  }, [syncGradesFromCache]);

  const initialize = useCallback(async () => {
    // Always sync cached data to widgets first, regardless of network state
    await Promise.all([syncTimetableToWidget(), syncGradesFromCache()]);

    try {
      await initializeAccountManager();

      await Promise.all([fetchEDT(), fetchGrades()]);

      if (settingsstore.showAlertAtLogin) {
        alert.showAlert({
          title: "Synchronisation réussie",
          description: "Toutes vos données ont été mises à jour avec succès.",
          icon: "CheckCircle",
          color: "#00C851",
          withoutNavbar: true,
          delay: 1000
        });
      }

    } catch (error) {
      if (String(error).includes("Unable to find")) { return; }
      alert.showAlert({
        title: t("Settings_Services_Alert_ErrorConnection"),
        description: t("Settings_Services_Alert_Failed_Login"),
        icon: "TriangleAlert",
        color: "#D60046",
        technical: String(error)
      });
    }
  }, [alert, fetchEDT, fetchGrades, syncTimetableToWidget, syncGradesFromCache, settingsstore.showAlertAtLogin]);

  useEffect(() => {
    initialize();
  }, [initialize]);
};
