import { Services } from "@/stores/account/types";
import { getCredentials } from "@/utils/credentialStore";

const INTRACOM_API_URL = "https://intracom.epita.fr/api";

import { cachedDetails } from "./intracomTokenStore";

export { setIntracomTokenHelper } from "./intracomTokenStore";

interface IntracomTokenResponse {
    token: string;
    expiresIn?: number;
}

/**
 * Attempts to log in to Intracom headlessly using the provided credentials.
 * @param username 
 * @param password 
 * @returns The auth token if successful, null otherwise.
 */
export async function loginIntracom(username: string, password: string): Promise<string | null> {
    try {
        if (username === "webview" && password === "token_saved") {
            return cachedDetails.token;
        }

        return null;

    } catch (error) {
        console.error("Intracom Login Error:", error);
        return null;
    }
}

/**
 * Retrieves a valid Intracom token. 
 */
export async function getValidIntracomToken(): Promise<string | null> {
    if (cachedDetails.token) {
        return cachedDetails.token;
    }

    const credentials = await getCredentials(Services.INTRACOM);
    if (!credentials) {
        return null;
    }

    if (cachedDetails.token) { return cachedDetails.token; }

    try {
        const { loadIntracomToken } = await import('@/utils/credentialStore');
        const persistedToken = await loadIntracomToken();
        if (persistedToken) {
            console.log('[Intracom] Using persisted token from SecureStore.');
            const { setIntracomTokenHelper } = await import('./intracomTokenStore');
            setIntracomTokenHelper(persistedToken);
            return persistedToken;
        }
    } catch (e) {
        console.warn('[Intracom] Failed to load persisted token:', e);
    }

    try {
        const { loginIntracomPure } = await import('./intracomAuthWorker');
        const token = await loginIntracomPure(credentials.username, credentials.password);

        if (token) {
            console.log("[Intracom] Successfully acquired fresh headless token via Pure HTTP.");

            const { setIntracomTokenHelper } = await import('./intracomTokenStore');
            setIntracomTokenHelper(token);

            try {
                const { saveIntracomToken } = await import('@/utils/credentialStore');
                await saveIntracomToken(token);
            } catch (e) { }

            return token;
        }
    } catch (e) {
        console.warn("[Intracom] Could not perform headless login:", e);
    }

    return cachedDetails.token || null;
}

import CookieManager from '@react-native-cookies/cookies';

export async function getIntracomRequestHeaders(token: string | null): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    };

    if (token && token !== "full_headless_session") {
        headers["Authorization"] = `Bearer ${token}`;
        return headers;
    }

    try {
        await CookieManager.flush(); // Ensure sync
        let cookies = await CookieManager.get("https://intracom.epita.fr");

        if (Object.keys(cookies).length === 0) {
            console.log("[Intracom] No cookies for intracom subdomain, trying epita.fr...");
            cookies = await CookieManager.get("https://epita.fr");
        }

        if (Object.keys(cookies).length === 0) {
            console.log("[Intracom] Still no cookies, trying getAll dump...");
            const allCookies = await CookieManager.getAll(true);

            const authKeys = ["AUTH_SESSION", "KEYCLOAK", "sessionid", "csrftoken", "remember"];

            Object.keys(allCookies).forEach(key => {
                const c = allCookies[key];
                const isAuthCookie = authKeys.some(k => key.includes(k));
                const isEpita = c.domain && c.domain.includes("epita.fr");

                if (isEpita || isAuthCookie) {
                    cookies[key] = c;
                }
            });
        }

        const cookieStrings: string[] = [];
        let csrfToken = "";

        Object.keys(cookies).forEach(key => {
            const val = cookies[key].value;
            cookieStrings.push(`${key}=${val}`);
            if (key === "csrftoken") {
                csrfToken = val;
            }
        });

        if (cookieStrings.length > 0) {
            headers["Cookie"] = cookieStrings.join("; ");
            console.log(`[Intracom] Attached ${cookieStrings.length} cookies: ${Object.keys(cookies).join(", ")}`);

            if (csrfToken) {
                headers["X-CSRFToken"] = csrfToken;
                headers["X-XSRF-TOKEN"] = csrfToken;
                console.log("[Intracom] Attached CSRF Token header");
            }
        } else {
            console.log("[Intracom] No cookies found to attach.");
        }
    } catch (e) {
        console.warn("[Intracom] Failed to get cookies:", e);
    }

    return headers;
}
