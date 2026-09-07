import { fetchIntracomBonus, IntracomEventData, saveIntracomEventsToDatabase } from "@/database/useIntracomEvents";
import AbsencesAPI from "@/services/absences";
import AurigaAPI from "@/services/auriga";
import { loginAurigaPure } from "@/utils/aurigaAuthWorker";
import { getCredentials, saveAurigaRefreshToken } from "@/utils/credentialStore";
import { fetchIntracomProfile } from "@/utils/intracom";
import { getValidIntracomToken } from "@/utils/intracomAuth";
import { error, info } from "@/utils/logger/logger";
import { Services } from "@/stores/account/types";
import { useFlagsStore } from "@/stores/flags";

/**
 * Orchestrates the synchronization of all Intracom data.
 * This function can be called by a background task or foreground refresh.
 */
export async function syncAllServices(accountId: string): Promise<void> {
    if (useFlagsStore.getState().isDemoMode) {
        info("🎭 Demo mode active — skipping background sync.");
        return;
    }

    info("🔄 Starting global background sync...");

    await syncIntracomData(accountId);

    await syncAurigaData();

    await syncAttendanceData();

    info("✅ Global background sync complete.");
}

export async function syncIntracomData(accountId: string): Promise<void> {
    const token = await getValidIntracomToken();
    if (!token) {
        error("[Intracom] Unable to obtain valid token. Skipping sync.");
        return;
    }

    try {
        const profile = await fetchIntracomProfile(token);
        let studentId = "5808"; // Fallback
        if (profile && profile.studentId) {
            studentId = profile.studentId;
        }

        await fetchIntracomBonus(token);

        await fetchAndSaveIntracomEvents(token, studentId, accountId);
    } catch (e) {
        error(`[Intracom] Sync failed: ${e}`);
    }
}

async function syncAurigaData(): Promise<void> {
    try {
        const credentials = await getCredentials(Services.AURIGA);
        if (!credentials) {
            error("[Auriga] No credentials to perform headless sync. Skipping.");
            return;
        }

        const tokens = await loginAurigaPure(credentials.username, credentials.password);

        if (tokens.refresh_token) {
            await saveAurigaRefreshToken(tokens.refresh_token);
        }

        info("[Auriga] syncing with headless token...");
        AurigaAPI.setToken(tokens.access_token);
        await AurigaAPI.sync((msg) => info(`[Auriga] ${msg}`));
        info("[Auriga] Sync successful.");
    } catch (e) {
        error(`[Auriga] Sync failed: ${e}`);
    }
}

async function syncAttendanceData(): Promise<void> {
    if (!AbsencesAPI.isLoggedIn()) {
        error("[Attendance] No cached token available. Skipping sync.");
        return;
    }

    try {
        info("[Attendance] syncing...");
        await AbsencesAPI.sync();
        info("[Attendance] Sync successful.");
    } catch (e) {
        error(`[Attendance] Sync failed: ${e}`);
    }
}

/**
 * Fetches events from Intracom API and saves them to the database.
 */
async function fetchAndSaveIntracomEvents(token: string, studentId: string, accountId: string): Promise<void> {
    try {
        const res = await fetch(`https://intracom.epita.fr/api/Students/${studentId}/Events`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            error(`[Intracom] Failed to fetch events: ${res.status}`);
            return;
        }

        const data = await res.json();
        const allEvents: IntracomEventData[] = [];

        if (Array.isArray(data)) {
            data.forEach((semester: any) => {
                if (semester.events && Array.isArray(semester.events)) {
                    semester.events.forEach((evt: any) => {
                        allEvents.push({
                            id: evt.id,
                            date: evt.date, // "YYYY-MM-DD"
                            type: String(evt.type),
                            name: evt.title,
                            campusSlug: evt.campus ?? "unknown",
                            registeredStudents: 0,
                            nbNewStudents: 0,
                            maxStudents: 0,
                            state: "OPEN", // Assumption
                            address: evt.location?.address,
                            town: evt.location?.town,
                            bonus: evt.bonus,
                        });
                    });
                }
            });
        }

        await saveIntracomEventsToDatabase(allEvents, accountId);
        info(`[Intracom] Synced ${allEvents.length} events successfully.`);

    } catch (e) {
        error(`[Intracom] Error syncing events: ${e}`);
    }
}
