import { useEffect } from "react";
import { getGradePeriodsFromCache, getPeriodsFromCache } from "@/database/useGrades";
import { Grade } from "@/services/shared/grade";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import { getSubjectName } from "@/utils/subjects/name";
import { syncGradesToWidget } from "@/utils/widget/syncGrades";
import PapillonSubjectAvg from "@/utils/grades/algorithms/subject";

interface WidgetGrade extends Grade {
    subjectDisplayName: string;
}

function collectGrades(subjects: { name: string; grades?: Grade[]; subjects?: { name: string; grades?: Grade[] }[] }[]): WidgetGrade[] {
    const result: WidgetGrade[] = [];
    for (const subject of subjects) {
        for (const grade of subject.grades ?? []) {
            if (grade.studentScore?.value !== undefined && !isNaN(grade.studentScore.value) && !grade.studentScore.disabled) {
                result.push({ ...grade, subjectDisplayName: subject.name });
            }
        }
        for (const mod of subject.subjects ?? []) {
            for (const grade of mod.grades ?? []) {
                if (grade.studentScore?.value !== undefined && !isNaN(grade.studentScore.value) && !grade.studentScore.disabled) {
                    result.push({ ...grade, subjectDisplayName: mod.name });
                }
            }
        }
    }
    return result;
}

export const useGradesWidgetSync = () => {
    useEffect(() => {
        const syncFromCache = async () => {
            try {
                const periods = await getPeriodsFromCache();
                const currentPeriod = getCurrentPeriod(periods);
                if (!currentPeriod) return;

                const periodGrades = await getGradePeriodsFromCache(
                    currentPeriod.name,
                    currentPeriod.createdByAccount
                );

                const allGrades = collectGrades(periodGrades.subjects ?? []);
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
            } catch (e) {
                console.warn("[useGradesWidgetSync] Failed:", e);
            }
        };

        syncFromCache();
    }, []);
};
