import CookieManager from "@react-native-cookies/cookies";
import { useRouter } from "expo-router";
import * as Network from "expo-network";
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import AurigaAPI from "@/services/auriga";
import { initializeAccountManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { useAlert } from "@/ui/components/AlertProvider";
import { loginAurigaPure } from "@/utils/aurigaAuthWorker";
import { getCredentials, saveAurigaRefreshToken } from "@/utils/credentialStore";
import { useTranslation } from "react-i18next";

type AurigaRefreshContextType = {
    refreshAuriga: () => void;
    isRefreshing: boolean;
    syncLogs: string[];
};

const AurigaRefreshContext = createContext<AurigaRefreshContextType | undefined>(undefined);

export const useAurigaRefresh = () => {
    const context = useContext(AurigaRefreshContext);
    if (!context) {
        throw new Error("useAurigaRefresh must be used within an AurigaRefreshProvider");
    }
    return context;
};

interface AurigaRefreshProviderProps {
    children: ReactNode;
}

export const AurigaRefreshProvider = ({ children }: AurigaRefreshProviderProps) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [showLogModal, setShowLogModal] = useState(false);

    const router = useRouter();
    const alert = useAlert();
    const { t } = useTranslation();

    const getCookiesString = async () => {
        try {
            const allCookies = await CookieManager.getAll(true);
            const relevantCookies: string[] = [];
            Object.values(allCookies).forEach((c: any) => {
                relevantCookies.push(`${c.name}=${c.value}`);
            });
            return relevantCookies.join("; ");
        } catch (e) {
            return "";
        }
    };

    const addLog = useCallback((message: string) => {
        setSyncLogs(prev => [...prev, message]);
    }, []);

    const performSync = async (accessToken: string) => {
        setSyncLogs([]);
        //setShowLogModal(true);

        try {
            const cookiesString = await getCookiesString();
            AurigaAPI.setToken(accessToken);
            AurigaAPI.setCookie(cookiesString);

            await AurigaAPI.sync(addLog);

            const { accounts } = useAccountStore.getState();
            const existingAccount = accounts.find((acc) =>
                acc.services.some((s) => s.auth?.additionals?.type === "auriga")
            );

            if (existingAccount) {
                const aurigaService = existingAccount.services.find(
                    (s) => s.auth?.additionals?.type === "auriga"
                );
                if (aurigaService) {
                    useAccountStore.getState().updateServiceAuthData(aurigaService.id, {
                        accessToken: accessToken,
                        additionals: { type: "auriga", cookies: cookiesString },
                    });
                }
            }

            await initializeAccountManager();

            alert.showAlert({
                id: "auriga-sync",
                title: "Synchronisation terminée",
                message: "Tes données Auriga sont à jour.",
                icon: "Check",
                color: "#00D600",
            });

            setTimeout(() => {
                setShowLogModal(false);
            }, 2000);
        } catch (error) {
            console.error("Background Auriga Sync Error:", error);
            addLog(`❌ Sync error: ${error}`);
            alert.showAlert({
                id: "auriga-sync",
                title: "Erreur de synchronisation",
                message: "Impossible de récupérer tes données Auriga.",
                icon: "AlertCircle",
                color: "#D60000",
            });
            // Keep modal open on error so user can see logs
        } finally {
            setIsRefreshing(false);
        }
    };

    const refreshAuriga = useCallback(async () => {
        if (isRefreshing) { return; }

        setIsRefreshing(true);

        alert.showAlert({
            id: "auriga-sync",
            title: t("Settings_Services_Alert_Refreshing"),
            message: t("Settings_Services_Alert_Refreshing_Description"),
            icon: "RefreshCw",
            color: "#0078D4",
            delay: 60000, // Stay open until sync or fail completes
        });

        const credentials = await getCredentials(Services.AURIGA);

        if (!credentials) {
            alert.showAlert({
                id: "auriga-sync",
                title: t("Settings_Services_Alert_ErrorConnection"),
                message: t("Settings_Services_Alert_Failed_Login"),
                icon: "AlertCircle",
                color: "#D60000"
            });
            setIsRefreshing(false);
            router.push("/(onboarding)/university/multi/aurigaAuth?refresh=true" as any);
            return;
        }

        try {
            console.log("[AurigaRefresh] Démarrage de la connexion réseau Pure HTTP...");
            const tokens = await loginAurigaPure(credentials.username, credentials.password);

            if (tokens.refresh_token) {
                await saveAurigaRefreshToken(tokens.refresh_token);
            }

            console.log("[AurigaRefresh] Jeton d'accès acquis, démarrage de la synchronisation.");
            await performSync(tokens.access_token);

        } catch (e: any) {
            console.error("[AurigaRefresh] Échec de la connexion automatique:", e);
            alert.showAlert({
                id: "auriga-sync",
                title: t("Settings_Services_Alert_ErrorConnection"),
                message: t("Settings_Services_Alert_Failed_Login"),
                icon: "AlertCircle",
                color: "#D60000"
            });
            setIsRefreshing(false);

            // Si erreur critique d'authentification refusée, rediriger vers login
            if (e.message && e.message.includes('Refusée')) {
                router.push("/(onboarding)/university/multi/aurigaAuth?refresh=true" as any);
            }
        }

    }, [isRefreshing, alert, router]);

    const wasOffline = useRef(false);

    useEffect(() => {
        const checkAndSync = async () => {
            const state = await Network.getNetworkStateAsync();
            const online = Boolean(state.isInternetReachable ?? state.isConnected);
            if (wasOffline.current && online) {
                wasOffline.current = false;
                refreshAuriga();
            }
            if (!online) {
                wasOffline.current = true;
            }
        };

        const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
            if (nextState === "active") {
                checkAndSync();
            }
        });

        checkAndSync();

        return () => sub.remove();
    }, [refreshAuriga]);

    return (
        <AurigaRefreshContext.Provider value={{ refreshAuriga, isRefreshing, syncLogs }}>
            {children}

            {/* Sync Log Modal (Beta Feature) */}
            <Modal
                visible={showLogModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogModal(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.92)",
                        padding: 20,
                        paddingTop: 60,
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
                            🔄 Sync Logs (Beta)
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowLogModal(false)}
                            style={{ padding: 10 }}
                        >
                            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        {syncLogs.map((log, index) => (
                            <Text
                                key={index}
                                style={{
                                    color: log.includes("❌") ? "#ff6b6b" :
                                        log.includes("✅") ? "#69db7c" :
                                            log.includes("🎉") ? "#ffd43b" :
                                                log.includes("⚠️") ? "#ffa94d" : "#ced4da",
                                    fontSize: 11,
                                    fontFamily: "monospace",
                                    marginBottom: 3,
                                }}
                            >
                                {log}
                            </Text>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </AurigaRefreshContext.Provider>
    );
};
