import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { getDatabaseInstance } from '@/database/DatabaseProvider';
import IntracomEvent from '@/database/models/IntracomEvent';
import AbsencesAPI, { storage as absencesStorage } from '@/services/absences';
import { syncIntracomData } from '@/services/syncService';
import { useAccountStore } from '@/stores/account';
import { Services } from '@/stores/account/types';
import { getValidAttendanceToken } from '@/utils/attendanceAuth';
import {
    diffGradeIds,
    diffIntracomEventIds,
    getSeenGradeIds,
    getSeenIntracomEventIds,
    saveSeenGradeIds,
    saveSeenIntracomEventIds,
} from '@/utils/grades/gradeCache';
import { error, info } from '@/utils/logger/logger';
import {
    sendNewGradeNotification,
    sendNewIntracomEventNotification,
} from '@/utils/notification/alertNotification';
import { Q } from '@nozbe/watermelondb';

const ATTENDANCE_LAST_SYNC_KEY = 'absences_last_bg_sync';
const ATTENDANCE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const BACKGROUND_REFRESH_TASK = 'CHRYSALIDE_BACKGROUND_REFRESH';

/**
 * Core background refresh logic — exported so it can be called directly
 * from the debug screen for testing.
 */
export async function runBackgroundRefresh(): Promise<number> {
    try {
        info('[BgRefresh] Background task started');

        const accountId = useAccountStore.getState().lastUsedAccount;
        if (!accountId) {
            info('[BgRefresh] No account found, skipping');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        let didFetchNewData = false;

        // Auriga
        try {
            const credentials = await import('@/utils/credentialStore').then(m => m.getCredentials(Services.AURIGA));
            if (credentials) {
                const { loginAurigaPure } = await import('@/utils/aurigaAuthWorker');
                const tokens = await loginAurigaPure(credentials.username, credentials.password);

                if (tokens.refresh_token) {
                    const { saveAurigaRefreshToken } = await import('@/utils/credentialStore');
                    await saveAurigaRefreshToken(tokens.refresh_token);
                }

                if (tokens.access_token) {
                    const AurigaAPI = (await import('@/services/auriga')).default;
                    AurigaAPI.setToken(tokens.access_token);

                    const gradesBefore = AurigaAPI.getAllGrades().map((g) => g.code);
                    const seenIds = getSeenGradeIds();

                    await AurigaAPI.sync();

                    const gradesAfter = AurigaAPI.getAllGrades();
                    const gradeCodesAfter = gradesAfter.map((g) => g.code);

                    const brandNew = diffGradeIds(
                        gradeCodesAfter.filter((id) => !gradesBefore.includes(id)),
                        seenIds
                    );

                    const syllabusList = AurigaAPI.getAllSyllabus();
                    const { extractSubjectCode } = await import('@/services/auriga');
                    const { getSubjectName } = await import('@/utils/subjects/name');

                    for (const code of brandNew) {
                        const grade = gradesAfter.find((g) => g.code === code);
                        if (grade && grade.grade !== undefined) {
                            let subjectNameToNotify = grade.name.split('_').pop() ?? grade.name;

                            const gradeFullCode = extractSubjectCode(grade.name);
                            const matchingSyllabus = syllabusList.find((s: any) => {
                                const syllabusSubjectCode = extractSubjectCode(s.name);
                                return (
                                    gradeFullCode.startsWith(syllabusSubjectCode + "_") ||
                                    gradeFullCode === syllabusSubjectCode
                                );
                            });

                            if (matchingSyllabus) {
                                const rawSubName = matchingSyllabus.caption?.name || matchingSyllabus.name || gradeFullCode;
                                subjectNameToNotify = getSubjectName(rawSubName);
                            }

                            await sendNewGradeNotification(
                                subjectNameToNotify,
                                `${grade.grade}/20`
                            );
                            didFetchNewData = true;
                        }
                    }

                    const updatedSeen = getSeenGradeIds();
                    gradeCodesAfter.forEach((id) => updatedSeen.add(id));
                    saveSeenGradeIds(updatedSeen);

                    info(`[BgRefresh] Grades synced. ${brandNew.length} new.`);
                }
            } else {
                info('[BgRefresh] No Auriga credentials found, skipping');
            }
        } catch (e) {
            error(`[BgRefresh] Grades sync error: ${e}`);
        }

        // Absences
        try {
            const lastSyncStr = absencesStorage.getString(ATTENDANCE_LAST_SYNC_KEY);
            const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
            const now = Date.now();

            if (now - lastSync >= ATTENDANCE_SYNC_INTERVAL_MS) {
                info('[BgRefresh] Attendance: daily sync triggered');

                const token = await getValidAttendanceToken();
                if (token) {
                    AbsencesAPI.setToken(token);
                    const data = await AbsencesAPI.sync();
                    absencesStorage.set(ATTENDANCE_LAST_SYNC_KEY, String(now));
                    info(`[BgRefresh] Attendance synced: ${data?.length ?? 0} level(s)`);
                    didFetchNewData = true;
                } else {
                    info('[BgRefresh] Attendance: no valid token, skipping');
                }
            } else {
                const nextSyncIn = Math.round((ATTENDANCE_SYNC_INTERVAL_MS - (now - lastSync)) / 60000);
                info(`[BgRefresh] Attendance: next sync in ~${nextSyncIn} min`);
            }
        } catch (e) {
            error(`[BgRefresh] Attendance sync error: ${e}`);
        }

        // Intracom
        try {
            const db = getDatabaseInstance();

            const eventsBefore = await db
                .get<IntracomEvent>('intracom_events')
                .query(Q.where('createdByAccount', accountId))
                .fetch();
            const idsBefore = new Set(eventsBefore.map((e) => e.eventId));
            const seenEventIds = getSeenIntracomEventIds();

            await syncIntracomData(accountId);

            const eventsAfter = await db
                .get<IntracomEvent>('intracom_events')
                .query(Q.where('createdByAccount', accountId))
                .fetch();

            const idsAfter = eventsAfter.map((e) => e.eventId);
            const brandNew = diffIntracomEventIds(
                idsAfter.filter((id) => !idsBefore.has(id)),
                seenEventIds
            );
            if (brandNew.length > 0) {
                await sendNewIntracomEventNotification(brandNew.length);
                didFetchNewData = true;
            }

            const updatedSeenEvents = getSeenIntracomEventIds();
            idsAfter.forEach((id) => updatedSeenEvents.add(id));
            saveSeenIntracomEventIds(updatedSeenEvents);

            info(`[BgRefresh] Intracom synced. ${brandNew.length} new events.`);
        } catch (e) {
            error(`[BgRefresh] Intracom sync error: ${e}`);
        }

        info('[BgRefresh] Task complete');
        return didFetchNewData
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e) {
        error(`[BgRefresh] Fatal error: ${e}`);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}

TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
    return runBackgroundRefresh();
});

/**
 * Registers the hourly background refresh task and requests notification permissions.
 * Call once at app startup.
 */
export async function registerBackgroundRefresh(): Promise<void> {
    try {
        const { requestNotificationPermissions } = await import(
            '@/utils/notification/reminder/helper'
        );
        await requestNotificationPermissions();

        await BackgroundFetch.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
            minimumInterval: 60 * 60, // 1 hour
            stopOnTerminate: false,
            startOnBoot: true,
        });

        info('[BgRefresh] Background refresh task registered (interval: 1h)');
    } catch (e) {
        error(`[BgRefresh] Failed to register background task: ${e}`);
    }
}
