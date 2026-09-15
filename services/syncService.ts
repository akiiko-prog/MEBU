import AbsencesAPI from "@/services/absences";
import AurigaAPI from "@/services/auriga";
import { loginAurigaPure } from "@/utils/aurigaAuthWorker";
import { getCredentials, saveAurigaRefreshToken } from "@/utils/credentialStore";
import { error, info } from "@/utils/logger/logger";
import { Services } from "@/stores/account/types";
import { useFlagsStore } from "@/stores/flags";

/**
 * Orchestrates the synchronization of all services (Auriga, Absences).
 * This function can be called by a background task or foreground refresh.
 */
export async function syncAllServices(): Promise<void> {
    if (useFlagsStore.getState().isDemoMode) {
        info("🎭 Demo mode active — skipping background sync.");
        return;
    }

    info("🔄 Starting global background sync...");

    await syncAurigaData();

    await syncAttendanceData();

    info("✅ Global background sync complete.");
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
