import React, { createContext, useContext, useEffect, useRef } from "react";

import { Services } from "@/stores/account/types";
import { getCredentials, saveIntracomToken } from "@/utils/credentialStore";
import { loginIntracomPure } from "@/utils/intracomAuthWorker";
import { setIntracomTokenHelper } from "@/utils/intracomTokenStore";
import { warn } from "@/utils/logger/logger";

interface IntracomContextType {
    refreshIntracomSession: () => Promise<boolean>;
}

const IntracomContext = createContext<IntracomContextType | null>(null);

export const useIntracomRefresh = () => {
    const context = useContext(IntracomContext);
    if (!context) {
        throw new Error("useIntracomRefresh must be used within an IntracomRefreshProvider");
    }
    return context;
};

export let triggerIntracomRefreshGlobal: () => Promise<boolean> = async () => false;

export function IntracomRefreshProvider({ children }: { children: React.ReactNode }) {
    const pendingPromise = useRef<Promise<boolean> | null>(null);

    const refreshIntracomSession = (): Promise<boolean> => {
        console.log("[IntracomRefresh] Request received.");

        if (pendingPromise.current) {
            console.log("[IntracomRefresh] Joining existing refresh request...");
            return pendingPromise.current;
        }

        const promise = new Promise<boolean>(async (resolve) => {
            try {
                const credentials = await getCredentials(Services.INTRACOM);
                if (!credentials || !credentials.username || !credentials.password) {
                    warn("[IntracomRefresh] No credentials saved. Cannot refresh.");
                    resolve(false);
                    return;
                }

                console.log("[IntracomRefresh] Authenticating via Pure HTTP...");
                
                // Exécute silencieusement le login
                const jwtToken = await loginIntracomPure(credentials.username, credentials.password);
                
                if (jwtToken) {
                    console.log("[IntracomRefresh] Successfully acquired new Intracom JWT!");
                    
                    // Met à jour la RAM
                    setIntracomTokenHelper(jwtToken);
                    
                    // Persiste dans le SecureStore pour usages futurs
                    await saveIntracomToken(jwtToken);
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (e) {
                warn("[IntracomRefresh] Refresh failed:", e instanceof Error ? e.message : String(e));
                resolve(false);
            } finally {
                pendingPromise.current = null;
            }
        });

        pendingPromise.current = promise;
        return promise;
    };

    useEffect(() => {
        triggerIntracomRefreshGlobal = refreshIntracomSession;
    }, []);

    return (
        <IntracomContext.Provider value={{ refreshIntracomSession }}>
            {children}
        </IntracomContext.Provider>
    );
}
