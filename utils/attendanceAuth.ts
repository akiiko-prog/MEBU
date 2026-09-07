import { Services } from "@/stores/account/types";
import { getCredentials } from "@/utils/credentialStore";

const ATTENDANCE_API_URL = "https://absences.epita.net/api";

interface AttendanceTokenResponse {
    access_token: string;
    expires_in: number;
    user: {
        id: number;
        login: string;
        firstname: string;
        lastname: string;
        roleName: string;
    }
}

export async function loginAttendance(username: string, password: string): Promise<string | null> {
    try {
        console.log(`[AttendanceAuth] Logging in as ${username}...`);

        const response = await fetch(`${ATTENDANCE_API_URL}/Users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify({
                login: username,
                password: password
            })
        });

        if (!response.ok) {
            console.error(`[AttendanceAuth] Login failed with status: ${response.status}`);
            if (response.status === 401 || response.status === 403) {
                throw new Error("INVALID_CREDENTIALS");
            }
            throw new Error(`HTTP_ERROR_${response.status}`);
        }

        const data: AttendanceTokenResponse = await response.json();

        if (data.access_token) {
            console.log("[AttendanceAuth] Login successful, token received.");
            return data.access_token;
        }

        return null;

    } catch (error) {
        console.error("[AttendanceAuth] Login error:", error);
        throw error;
    }
}

export async function getValidAttendanceToken(): Promise<string | null> {
    try {
        const credentials = await getCredentials(Services.ATTENDANCE);
        if (!credentials) {
            console.log("[AttendanceAuth] No stored credentials for Attendance.");
            return null;
        }

        console.log("[AttendanceAuth] Restoring token from stored credentials...");
        return await loginAttendance(credentials.username, credentials.password);
    } catch {
        return null;
    }
}