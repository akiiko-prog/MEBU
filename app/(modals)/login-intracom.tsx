import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert } from 'react-native';

import LoginScreenLayout from "@/components/login/LoginScreenLayout";
import { isDemoCredentials } from "@/services/demo";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { useAlert } from "@/ui/components/AlertProvider";
import { saveCredentials, saveIntracomToken } from "@/utils/credentialStore";
import { loginIntracomPure } from "@/utils/intracomAuthWorker";
import { setIntracomTokenHelper } from "@/utils/intracomTokenStore";
import { useTranslation } from "react-i18next";

export default function IntracomLoginScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { t } = useTranslation();
    const [loginStatus, setLoginStatus] = useState(t("ONBOARDING_LOADING_LOGIN"));

    const alert = useAlert();
    const router = useRouter();
    const accountStore = useAccountStore();

    const handleLoginPress = async () => {
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
            const fakeToken = "DEMO_INTRACOM_TOKEN_NOT_REAL";
            await saveIntracomToken(fakeToken);
            setIntracomTokenHelper(fakeToken);
            accountStore.setServiceCredentials(Services.INTRACOM, true);
            alert.showAlert({
                title: t("Settings_Services_Alert_SuccessConnect"),
                message: t("Settings_Services_Alert_SuccessConnect_Description"),
                icon: "Check",
                color: "#00D600"
            });
            router.back();
            return;
        }

        try {
            // Tentative de connexion via Pure HTTP
            console.log("[IntracomLogin] Tentative de connexion silencieuse...");
            const token = await loginIntracomPure(username, password);

            if (token) {
                // Sauvegarde du mot de passe en SecureStore pour les refresh futurs
                await saveCredentials(Services.INTRACOM, username, password);

                // Sauvegarde du JWT nouvellement acquis
                await saveIntracomToken(token);
                // Mise à jour de la RAM
                setIntracomTokenHelper(token);

                // Informe le store de l'app que le composant est actif
                accountStore.setServiceCredentials(Services.INTRACOM, true);

                alert.showAlert({
                    title: t("Settings_Services_Alert_SuccessConnect"),
                    message: t("Settings_Services_Alert_SuccessConnect_Description"),
                    icon: "Check",
                    color: "#00D600"
                });

                router.back();
            } else {
                Alert.alert("Erreur", "Aucun jeton retourné par le serveur.");
            }
        } catch (e: any) {
            console.error("[IntracomLogin] Erreur :", e);
            alert.showAlert({
                title: t("Attendance_Login_Error_Title"),
                description: t("Attendance_Login_Error_InvalidCredentials"),
                icon: "AlertCircle",
                color: "#D60000"
            });
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <LoginScreenLayout
            title="Intracom"
            subtitle={t("Onboarding_Login_Intracom_Subtitle")}
            color="#0078D4"
            isLoading={isLoggingIn}
            loadingText={loginStatus}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onLogin={handleLoginPress}
            usernamePlaceholder={t("Onboarding_Login_Username_Placeholder")}
        />
    );
}
