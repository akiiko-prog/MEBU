import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { getCredentials, loadAurigaRefreshToken, saveAurigaRefreshToken } from "@/utils/credentialStore";

const KEYCLOAK_TOKEN_URL = "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/token";
const CLIENT_ID = "np-front";

interface KeycloakTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}

/**
 * Attempts to get a new access token using a stored refresh token.
 * This is the primary approach for background authentication.
 */
async function refreshAurigaToken(refreshToken: string): Promise<string | null> {
    try {
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        const response = await fetch(KEYCLOAK_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            console.warn(`[AurigaAuth] Refresh token failed: ${response.status}`);
            return null;
        }

        const data: KeycloakTokenResponse = await response.json();

        // DEBUG: check token lifetimes
        console.log('[AurigaAuth] Token lifetimes:', JSON.stringify({
            access_token_expires_in: data.expires_in,
            refresh_token_expires_in: (data as any).refresh_expires_in,
            scope: (data as any).scope,
        }));

        // Persist the new refresh token for next time
        if (data.refresh_token) {
            await saveAurigaRefreshToken(data.refresh_token);
        }

        console.log('[AurigaAuth] Successfully refreshed access token via refresh_token grant.');
        return data.access_token;
    } catch (e) {
        console.warn('[AurigaAuth] Refresh token error:', e);
        return null;
    }
}

/**
 * Attempts ROPC login (may be blocked by Keycloak client config).
 */
export async function loginAuriga(username: string, password: string): Promise<string | null> {
    try {
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('grant_type', 'password');
        params.append('username', username);
        params.append('password', password);

        const response = await fetch(KEYCLOAK_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            console.error(`Auriga Login failed: ${response.status}`);
            return null;
        }

        const data: KeycloakTokenResponse = await response.json();

        // Persist refresh token if available
        if (data.refresh_token) {
            await saveAurigaRefreshToken(data.refresh_token);
        }

        return data.access_token;
    } catch (error) {
        console.error("Auriga Login Error:", error);
        return null;
    }
}

/**
 * Retrieves a valid Auriga token for background use.
 * Priority:
 * 1. Refresh token from SecureStore (grant_type=refresh_token)
 * 2. Cached access token from account store (short-lived, 60s)
 * 3. ROPC fallback (usually blocked)
 */
export async function getValidAurigaToken(): Promise<string | null> {
    try {
        const refreshToken = await loadAurigaRefreshToken();
        if (refreshToken) {
            const accessToken = await refreshAurigaToken(refreshToken);
            if (accessToken) return accessToken;
        }
    } catch (e) {
        console.warn('[AurigaAuth] Refresh token flow failed:', e);
    }

    try {
        const { accounts, lastUsedAccount } = useAccountStore.getState();
        const account = accounts.find(a => a.id === lastUsedAccount);
        if (account) {
            const aurigaService = account.services.find(
                s => s.auth?.additionals?.type === 'auriga'
            );
            if (aurigaService?.auth?.accessToken) {
                console.log('[AurigaAuth] Using cached foreground token (may be expired).');
                return aurigaService.auth.accessToken;
            }
        }
    } catch (e) {
        console.warn('[AurigaAuth] Failed to read cached token:', e);
    }

    const credentials = await getCredentials(Services.AURIGA);
    if (!credentials) {
        console.log('[AurigaAuth] No credentials found.');
        return null;
    }
    console.log('[AurigaAuth] Attempting ROPC login (may fail)...');
    return await loginAuriga(credentials.username, credentials.password);
}
