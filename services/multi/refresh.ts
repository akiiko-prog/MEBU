import { authWithRefreshToken, Multi } from "esup-multi.js";

import { useAccountStore } from "@/stores/account";
import { Auth, Services } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";
import { loginAurigaPure } from "@/utils/aurigaAuthWorker";
import { getCredentials, saveAurigaRefreshToken } from "@/utils/credentialStore";

export async function refreshMultiSession(
  accountId: string,
  credentials: Auth
): Promise<{ auth: Auth; session: Multi }> {

  if (credentials.additionals?.type === "auriga") {
    // Pure HTTP background refresh for Auriga
    try {
        const savedCreds = await getCredentials(Services.AURIGA);
        if (!savedCreds) {
            throw new Error("No Auriga credentials available for background refresh");
        }
        
        const tokens = await loginAurigaPure(savedCreds.username, savedCreds.password);
        
        if (tokens.refresh_token) {
            await saveAurigaRefreshToken(tokens.refresh_token);
        }
        
        const authData: Auth = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || credentials.refreshToken,
            additionals: credentials.additionals
        };
        
        useAccountStore.getState().updateServiceAuthData(accountId, authData);
        
        return { auth: authData, session: undefined as any };
    } catch (e) {
        error(`Auriga background refresh failed: ${e}`, "refreshMultiSession");
        throw e;
    }
  }

  if (!credentials.refreshToken) {
    error("Unable to find refreshToken", "refreshMultiSession");
    throw new Error("Unable to find refreshToken");
  }

  const instanceUrl = credentials.additionals?.["instanceUrl"] as string;
  const session = await authWithRefreshToken(instanceUrl, {
    refreshAuthToken: credentials.refreshToken,
  });

  const authData: Auth = {
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    additionals: {
      instanceUrl: instanceUrl,
    },
  };

  useAccountStore.getState().updateServiceAuthData(accountId, authData);

  return { auth: authData, session };
}
