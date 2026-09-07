import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlert } from "@/ui/components/AlertProvider";

import LoginScreenLayout from "@/components/login/LoginScreenLayout";
import { isDemoCredentials } from "@/services/demo";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import AbsencesAPI from "@/services/absences";
import { loginAttendance } from "@/utils/attendanceAuth";
import { saveCredentials } from "@/utils/credentialStore";

export default function AttendanceLoginScreen() {
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

        if (isDemoCredentials(username, password)) {
            AbsencesAPI.setToken("DEMO_TOKEN_NOT_REAL");
            accountStore.setServiceCredentials(Services.ATTENDANCE, true);
            alert.showAlert({
                title: t("Attendance_Login_Success_Title"),
                description: t("Attendance_Login_Success_Description"),
                icon: "Check",
                color: "#00D600"
            });
            router.dismiss();
            router.push("/(features)/attendance");
            return;
        }

        setLoading(true);

        try {
            await saveCredentials(Services.ATTENDANCE, username, password);
            const token = await loginAttendance(username, password);

            if (token) {
                AbsencesAPI.setToken(token);
                accountStore.setServiceCredentials(Services.ATTENDANCE, true);
                alert.showAlert({
                    title: t("Attendance_Login_Success_Title"),
                    description: t("Attendance_Login_Success_Description"),
                    icon: "Check",
                    color: "#00D600"
                });
                router.dismiss();
                router.push("/(features)/attendance");
            } else {
                alert.showAlert({
                    title: t("Attendance_Login_Error_Title"),
                    description: t("Attendance_Login_Error_InvalidCredentials"),
                    icon: "AlertCircle",
                    color: "#D60000"
                });
            }

        } catch (error: any) {
            console.error(error);
            if (error?.message === "INVALID_CREDENTIALS") {
                alert.showAlert({
                    title: t("Attendance_Login_Error_Title"),
                    description: t("Attendance_Login_Error_InvalidCredentials"),
                    icon: "AlertCircle",
                    color: "#D60000"
                });
            } else {
                alert.showAlert({
                    title: t("Attendance_Login_Error_Title"),
                    description: t("Attendance_Login_Error_Generic"),
                    icon: "AlertCircle",
                    color: "#D60000"
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <LoginScreenLayout
            title="Absences"
            subtitle={t("Onboarding_Login_Attendance_Subtitle")}
            color="#0078D4"
            isLoading={loading}
            loadingText={t("Onboarding_Login_Loading")}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onLogin={handleLogin}
            usernamePlaceholder={t("Onboarding_Login_Username_Placeholder")}
        />
    );
}