import CookieManager from '@react-native-cookies/cookies';
import { useTheme } from "@react-navigation/native";
import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingInput from "@/components/onboarding/OnboardingInput";
import AurigaAPI, { storage } from "@/services/auriga";
import { DEMO_ACCOUNT_ID, isDemoCredentials, seedDemoData } from "@/services/demo";
import { initializeAccountManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { Account, Services } from "@/stores/account/types";
import { useFlagsStore } from "@/stores/flags";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";
import { loginAurigaPure } from "@/utils/aurigaAuthWorker";
import { getCredentials, saveAurigaRefreshToken, saveCredentials } from "@/utils/credentialStore";
import { useTranslation } from "react-i18next";

export default function AurigaLoginScreen() {
    const [isSyncing, setIsSyncing] = useState(false);
    const { t } = useTranslation();
    const [syncStatus, setSyncStatus] = useState(t("Auriga_Sync_Success_Description"));
    const alert = useAlert();
    const theme = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const params = useLocalSearchParams();
    const isRefresh = params.refresh === "true";

    React.useEffect(() => {
        let cancelled = false;

        (async () => {
            const saved = await getCredentials(Services.AURIGA);
            if (cancelled) return;
            if (saved) {
                setUsername(saved.username);
                setPassword(saved.password);
            }

            if (isRefresh && saved) {
                setIsSyncing(true);
                try {
                    const tokens = await loginAurigaPure(saved.username, saved.password);
                    if (tokens.refresh_token) {
                        await saveAurigaRefreshToken(tokens.refresh_token);
                    }
                    await startSync(tokens.access_token, saved.username);
                } catch (e: any) {
                    console.error("Refresh token fetch failed:", e);
                    handleInvalidCredentials(e.message);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isRefresh]);

    const getCookiesString = async (url: string) => {
        try {
            const allCookies = await CookieManager.getAll(true);
            const relevantCookies: string[] = [];
            Object.values(allCookies).forEach((c: any) => {
                relevantCookies.push(`${c.name}=${c.value}`);
            });
            return relevantCookies.join('; ');
        } catch (e) {
            return "";
        }
    }

    const startSync = async (accessToken: string, loginUsername: string = username) => {
        if (isRefresh) {
            setIsSyncing(false);
            router.back();

            alert.showAlert({
                title: t("Auriga_Sync_Success_Title"),
                message: t("Auriga_Sync_Success_Description"),
                icon: "RefreshCw",
                color: "#0078D4",
                delay: 3000,
            });

            (async () => {
                try {
                    const cookiesString = await getCookiesString("https://my.esme.fr");
                    AurigaAPI.setToken(accessToken);
                    AurigaAPI.setCookie(cookiesString);

                    await AurigaAPI.sync();

                    const { accounts } = useAccountStore.getState();
                    const existingAccount = accounts.find(acc =>
                        acc.services.some(s => s.auth?.additionals?.type === 'auriga')
                    );

                    if (existingAccount) {
                        const aurigaService = existingAccount.services.find(
                            s => s.auth?.additionals?.type === 'auriga'
                        );
                        if (aurigaService) {
                            useAccountStore.getState().updateServiceAuthData(aurigaService.id, {
                                accessToken: accessToken,
                                additionals: { type: 'auriga', cookies: cookiesString, username: loginUsername }
                            });
                        }
                    }

                    await initializeAccountManager();

                    alert.showAlert({
                        title: "Synchronisation terminée",
                        message: "Tes données Auriga sont à jour.",
                        icon: "Check",
                        color: "#00D600"
                    });
                } catch (error) {
                    console.error("Background Auriga Sync Error:", error);
                    alert.showAlert({
                        title: "Erreur de synchronisation",
                        message: "Impossible de récupérer tes données Auriga.",
                        icon: "AlertCircle",
                        color: "#D60000"
                    });
                }
            })();
            return;
        }

        try {
            const cookiesString = await getCookiesString("https://my.esme.fr");
            AurigaAPI.setToken(accessToken);
            AurigaAPI.setCookie(cookiesString);

            setSyncStatus(t("Auriga_Sync_Success_Informations"));
            let studentFirstName = "Etudiant";
            let studentLastName = "EPITA";

            try {
                const meResponse = await fetch("https://my.esme.fr/api/me", {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                    },
                });
                if (meResponse.ok) {
                    const meData = await meResponse.json();
                    studentFirstName = meData.person?.currentFirstName || "Etudiant";
                    studentLastName = meData.person?.currentLastName || "EPITA";
                }
            } catch (e) {
                console.warn("Could not fetch /api/me:", e);
            }

            setSyncStatus(t("Auriga_Sync_Success_CreateAccount"));

            const { accounts } = useAccountStore.getState();
            const existingAccount = accounts.find(acc =>
                acc.services.some(s => s.auth?.additionals?.type === 'auriga')
            );

            let accountId = "";

            if (existingAccount) {
                accountId = existingAccount.id;
                const aurigaService = existingAccount.services.find(
                    s => s.auth?.additionals?.type === 'auriga'
                );
                if (aurigaService) {
                    useAccountStore.getState().updateServiceAuthData(aurigaService.id, {
                        accessToken: accessToken,
                        additionals: { type: 'auriga', cookies: cookiesString, username: loginUsername }
                    });
                }
                const currentLastUsed = useAccountStore.getState().lastUsedAccount;
                if (currentLastUsed !== existingAccount.id) {
                    useAccountStore.getState().setLastUsedAccount(existingAccount.id);
                }
            } else {
                accountId = Crypto.randomUUID();
                const serviceId = Crypto.randomUUID();

                const newAccount: Account = {
                    id: accountId,
                    firstName: studentFirstName,
                    lastName: studentLastName,
                    schoolName: "EPITA",
                    services: [{
                        id: serviceId,
                        serviceId: Services.MULTI,
                        auth: {
                            accessToken: accessToken,
                            additionals: { type: 'auriga', cookies: cookiesString, username: loginUsername }
                        },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                const { addAccount, setLastUsedAccount } = useAccountStore.getState();
                addAccount(newAccount);
                setLastUsedAccount(accountId);
            }

            setSyncStatus(t("Auriga_Sync_Success_Description"));

            try {
                await AurigaAPI.sync();
            } catch (e) {
                console.warn("Auriga sync failed:", e);
            }

            await initializeAccountManager();

            alert.showAlert({
                title: t("Settings_Services_Alert_SuccessConnect"),
                description: t("Settings_Services_Alert_Connected"),
                icon: "Check",
                color: "#00D600"
            });

            setIsSyncing(false);
            if (storage.getString("linked_from_settings") === "true") {
                storage.set("linked_from_settings", "false");
                router.back();
                return;
            }
            router.replace({
                pathname: "/(onboarding)/end/color",
                params: {
                    accountId: accountId,
                },
            });

        } catch (error) {
            console.error("Auriga Sync Error:", error);
            alert.showAlert({
                title: t("Settings_Services_Alert_ErrorConnection"),
                description: t("Settings_Services_Alert_Failed_Login"),
                icon: "AlertCircle",
                color: "#D60000"
            });
            setIsSyncing(false);
        }
    };

    const handleInvalidCredentials = async (errorMsg?: string) => {
        setIsSyncing(false);
        const description = typeof errorMsg === 'string' && errorMsg.includes('Authentification refusée')
            ? "Mot de passe ou email incorrect."
            : "Erreur de connexion Auriga.";

        await alert.showAlert({
            title: t("Settings_Services_Alert_ErrorConnection"),
            description: t("Settings_Services_Alert_Failed_Login"),
            icon: "AlertCircle",
            color: "#D60000"
        });
    };

    const handleLogin = async () => {
        if (!username || !password) {
            alert.showAlert({
                title: t("Settings_Services_Alert_Fields_Title"),
                description: t("Settings_Services_Alert_Fields_Description"),
                icon: "AlertCircle",
                color: "#D60000"
            });
            return;
        }

        if (isDemoCredentials(username, password)) {
            setIsSyncing(true);
            setSyncStatus("Chargement du compte démo...");

            try {
                const accountId = DEMO_ACCOUNT_ID;
                const { accounts, addAccount, setLastUsedAccount } = useAccountStore.getState();

                const existingDemo = accounts.find((a) => a.id === accountId);
                if (!existingDemo) {
                    const demoAccount: Account = {
                        id: accountId,
                        firstName: "Alex",
                        lastName: "DEMO",
                        schoolName: "EPITA",
                        services: [
                            {
                                id: Crypto.randomUUID(),
                                serviceId: Services.MULTI,
                                auth: {
                                    accessToken: "DEMO_TOKEN_NOT_REAL",
                                    additionals: { type: "auriga", cookies: "" },
                                },
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    addAccount(demoAccount);
                }
                setLastUsedAccount(accountId);

                useFlagsStore.getState().setDemoMode(true);

                setSyncStatus("Génération des données de démo...");
                await seedDemoData(accountId);

                await initializeAccountManager();

                alert.showAlert({
                    title: "Compte démo chargé",
                    description: "Bienvenue sur le compte démo MEBU ! Toutes les données sont fictives.",
                    icon: "Check",
                    color: "#00D600",
                });

                setIsSyncing(false);

                if (storage.getString("linked_from_settings") === "true") {
                    storage.set("linked_from_settings", "false");
                    router.back();
                    return;
                }
                router.replace({
                    pathname: "/(onboarding)/end/color",
                    params: { accountId },
                });
            } catch (e: any) {
                console.error("[Demo] Failed to seed demo data:", e);
                setIsSyncing(false);
                alert.showAlert({
                    title: "Erreur démo",
                    description: "Impossible de charger les données démo.",
                    icon: "AlertCircle",
                    color: "#D60000",
                });
            }
            return;
        }

        setIsSyncing(true);
        setSyncStatus(t("Auriga_Sync_Success_Portail"));

        try {
            await saveCredentials(Services.AURIGA, username, password);

            const tokens = await loginAurigaPure(username, password);
            if (tokens.refresh_token) {
                await saveAurigaRefreshToken(tokens.refresh_token);
                console.log("[AurigaAuth] Refresh token persisted.");
            }

            await startSync(tokens.access_token);
        } catch (e: any) {
            console.error("Background Login Error: ", e);
            await handleInvalidCredentials(e.message);
        }
    };

    if (isSyncing) {
        return (
            <ViewContainer>
                <StackLayout vAlign="center" hAlign="center" style={{ flex: 1, backgroundColor: colors.background }} gap={20}>
                    <ActivityIndicator size="large" color="#0078D4" />
                    <Typography variant="h3">Synchronisation...</Typography>
                    <Typography variant="body1" style={{ opacity: 0.7, textAlign: 'center', paddingHorizontal: 20 }}>{syncStatus}</Typography>
                </StackLayout>
            </ViewContainer>
        );
    }

    return (
        <ViewContainer>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <StackLayout
                    padding={32}
                    backgroundColor="#0078D4"
                    gap={20}
                    style={{
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        borderBottomLeftRadius: 42,
                        borderBottomRightRadius: 42,
                        borderCurve: "continuous",
                        paddingTop: insets.top + 20,
                        paddingBottom: 40,
                        minHeight: 250,
                    }}
                >
                    <StackLayout vAlign="start" hAlign="start" width="100%" gap={6}>
                        <Typography variant="h1" style={{ color: "white", fontSize: 32, lineHeight: 34 }}>
                            Auriga
                        </Typography>
                        <Typography variant="h5" style={{ color: "#FFFFFF", lineHeight: 22, fontSize: 18 }}>
                            {t("Onboarding_Login_Auriga_Subtitle")}
                        </Typography>
                    </StackLayout>
                </StackLayout>

                <StackLayout
                    style={{ flex: 1, padding: 20, paddingTop: 40 }}
                    gap={16}
                >
                    <OnboardingInput
                        placeholder="Login (ex: p.n@epita.fr)"
                        text={username}
                        setText={setUsername}
                        icon="User"
                        inputProps={{
                            autoCapitalize: "none",
                            autoCorrect: false,
                            textContentType: "username",
                            autoComplete: "username"
                        }}
                    />
                    <OnboardingInput
                        placeholder={t("INPUT_PASSWORD")}
                        text={password}
                        setText={setPassword}
                        icon="Lock"
                        isPassword={true}
                        inputProps={{
                            autoCapitalize: "none",
                            autoCorrect: false,
                            textContentType: "password",
                            autoComplete: "password"
                        }}
                    />

                    <Button
                        title={t("LOGIN_BTN")}
                        onPress={handleLogin}
                        style={{ backgroundColor: "#0078D4", marginTop: 20 }}
                        size="large"
                    />
                    <Button
                        title={t("ONBOARDING_HELP_BTN")}
                        style={{ backgroundColor: "#00000000" }}
                        size="large"
                        variant="ghost"
                        color="text"
                        onPress={() => {
                            router.navigate("/(modals)/needHelpAuriga")
                        }}
                    />
                    <Typography variant="caption" style={{ textAlign: 'center', opacity: 0.5, marginTop: 10 }}>
                        {t("Onboarding_Login_Subtitle")}
                    </Typography>
                </StackLayout>
            </View>

            <OnboardingBackButton />
        </ViewContainer>
    );
}