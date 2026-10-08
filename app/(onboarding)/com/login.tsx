import { useTheme } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingInput from "@/components/onboarding/OnboardingInput";
import { signInCom } from "@/services/events";
import { initializeAccountManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { Account } from "@/stores/account/types";
import { useFlagsStore } from "@/stores/flags";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";

const COM_ACCOUNT_ID = "com-account";

/**
 * Connexion du compte partagé de la communication de l'école. Pas de compte
 * Auriga : l'authentification passe par Supabase Auth, et le profil ne donne
 * accès qu'aux événements (création/modification) et aux liens.
 */
export default function ComLoginScreen() {
    const alert = useAlert();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            alert.showAlert({
                title: "Champs manquants",
                description: "Renseigne l'email et le mot de passe du compte communication.",
                icon: "AlertCircle",
                color: "#D60000"
            });
            return;
        }

        setLoading(true);
        const signedInEmail = await signInCom(email, password);

        if (!signedInEmail) {
            setLoading(false);
            alert.showAlert({
                title: "Connexion refusée",
                description: "Email ou mot de passe incorrect.",
                icon: "AlertCircle",
                color: "#D60000"
            });
            return;
        }

        const { accounts, addAccount, setLastUsedAccount } = useAccountStore.getState();
        if (!accounts.find((a) => a.id === COM_ACCOUNT_ID)) {
            const comAccount: Account = {
                id: COM_ACCOUNT_ID,
                firstName: "Communication",
                lastName: "ESME",
                schoolName: "ESME",
                services: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            addAccount(comAccount);
        }
        setLastUsedAccount(COM_ACCOUNT_ID);

        useFlagsStore.getState().setTeacher(false);
        useFlagsStore.getState().setCom(true);

        await initializeAccountManager();
        setLoading(false);

        router.replace({
            pathname: "/(onboarding)/end/color",
            params: { accountId: COM_ACCOUNT_ID },
        });
    };

    if (loading) {
        return (
            <ViewContainer>
                <StackLayout vAlign="center" hAlign="center" style={{ flex: 1, backgroundColor: colors.background }} gap={20}>
                    <ActivityIndicator size="large" color="#0078D4" />
                    <Typography variant="h3">Connexion...</Typography>
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
                            Communication
                        </Typography>
                        <Typography variant="h5" style={{ color: "#FFFFFF", lineHeight: 22, fontSize: 18 }}>
                            Compte partagé du service communication de l'école
                        </Typography>
                    </StackLayout>
                </StackLayout>

                <StackLayout
                    style={{ flex: 1, padding: 20, paddingTop: 40 }}
                    gap={16}
                >
                    <OnboardingInput
                        placeholder="Email"
                        text={email}
                        setText={setEmail}
                        icon="User"
                        inputProps={{
                            autoCapitalize: "none",
                            autoCorrect: false,
                            keyboardType: "email-address",
                            textContentType: "username",
                            autoComplete: "email"
                        }}
                    />
                    <OnboardingInput
                        placeholder="Mot de passe"
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
                        title="Se connecter"
                        onPress={handleLogin}
                        style={{ backgroundColor: "#0078D4", marginTop: 20 }}
                        size="large"
                    />
                </StackLayout>
            </View>

            <OnboardingBackButton />
        </ViewContainer>
    );
}
