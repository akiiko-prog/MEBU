import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import LoginScreenLayout from "@/components/login/LoginScreenLayout";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { loginAuriga } from "@/utils/aurigaAuth";
import { saveCredentials } from "@/utils/credentialStore";
import { useAlert } from "@/ui/components/AlertProvider";

export default function AurigaLoginScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const accountStore = useAccountStore();
    const alert = useAlert();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

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

        setLoading(true);

        try {
            await saveCredentials(Services.AURIGA, username, password);
            const token = await loginAuriga(username, password);
            if (token) {
                // Update the existing Multi service (auriga type) to mark credentials as stored
                const account = accountStore.accounts.find(a => a.id === accountStore.lastUsedAccount);
                const multiService = account?.services.find(
                    s => s.serviceId === Services.MULTI && s.auth?.additionals?.type === "auriga"
                );
                if (multiService) {
                    accountStore.updateServiceAuthData(multiService.id, {
                        ...multiService.auth,
                        additionals: {
                            ...multiService.auth.additionals,
                            hasStoredCredentials: 1,
                        },
                    });
                }

                Alert.alert(t("Settings_Services_Alert_SuccessConnect"), t("Settings_Services_Alert_Connected"));
                router.back();
            } else {
                Alert.alert(t("Settings_Services_Alert_Error"), t("Settings_Services_Alert_Failed_Login"));
            }

        } catch (error) {
            console.error(error);
            Alert.alert(t("Settings_Services_Alert_Error"), t("Settings_Services_Alert_Failed_Login"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <LoginScreenLayout
            title="Auriga"
            subtitle={t("Settings_Services_Auriga_Subtitle")}
            color="#0078D4"
            isLoading={loading}
            loadingText={t("Onboarding_Login_Loading")}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onLogin={handleLogin}
            usernamePlaceholder="Login (ex: p.n@epita.fr)"
        />
    );
}
