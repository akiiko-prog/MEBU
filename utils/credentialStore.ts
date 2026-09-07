import * as SecureStore from 'expo-secure-store';

import { Services } from '@/stores/account/types';

const getServiceKey = (service: Services) => `credentials_${service}`;
const INTRACOM_TOKEN_KEY = 'intracom_jwt_token';

export async function saveCredentials(service: Services, username: string, password: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(getServiceKey(service), JSON.stringify({ username, password }));
    } catch (error) {
        console.error(`Failed to save credentials for service ${service}:`, error);
        throw error;
    }
}

export async function getCredentials(service: Services): Promise<{ username: string, password: string } | null> {
    try {
        const result = await SecureStore.getItemAsync(getServiceKey(service));
        if (result) {
            return JSON.parse(result);
        }
        return null;
    } catch (error) {
        console.error(`Failed to retrieve credentials for service ${service}:`, error);
        return null;
    }
}

export async function removeCredentials(service: Services): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(getServiceKey(service));
    } catch (error) {
        console.error(`Failed to remove credentials for service ${service}:`, error);
        // Don't throw — missing credentials shouldn't block account deletion
    }
}

export async function hasCredentials(service: Services): Promise<boolean> {
    const creds = await getCredentials(service);
    return creds !== null;
}

/**
 * Persists the Intracom JWT to SecureStore so the background task can read it without a WebView.
 */
export async function saveIntracomToken(token: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(INTRACOM_TOKEN_KEY, token);
    } catch (e) {
        console.warn('[CredentialStore] Failed to persist Intracom token:', e);
    }
}

/**
 * Reads the persisted Intracom JWT. Used by background tasks.
 */
export async function loadIntracomToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(INTRACOM_TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Removes the persisted Intracom JWT (call on logout).
 */
export async function clearIntracomToken(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(INTRACOM_TOKEN_KEY);
    } catch { }
}

const AURIGA_REFRESH_TOKEN_KEY = 'auriga_refresh_token';

export async function saveAurigaRefreshToken(token: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(AURIGA_REFRESH_TOKEN_KEY, token);
    } catch (e) {
        console.warn('[CredentialStore] Failed to persist Auriga refresh token:', e);
    }
}

export async function loadAurigaRefreshToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(AURIGA_REFRESH_TOKEN_KEY);
    } catch {
        return null;
    }
}

export async function clearAurigaRefreshToken(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(AURIGA_REFRESH_TOKEN_KEY);
    } catch { }
}
