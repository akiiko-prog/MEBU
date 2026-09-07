import { useTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingInput from "@/components/onboarding/OnboardingInput";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";
import { useTranslation } from "react-i18next";

interface LoginScreenLayoutProps {
    title: string;
    subtitle: string;
    color: string;
    isLoading: boolean;
    loadingText?: string;
    username: string;
    setUsername: (text: string) => void;
    password: string;
    setPassword: (text: string) => void;
    onLogin: () => void;

    usernamePlaceholder?: string;
    passwordPlaceholder?: string;
    children?: React.ReactNode;
}

export default function LoginScreenLayout({
    title,
    subtitle,
    color,
    isLoading,
    loadingText,
    username,
    setUsername,
    password,
    setPassword,
    onLogin,
    usernamePlaceholder,
    passwordPlaceholder,
    children
}: LoginScreenLayoutProps) {
    const theme = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    return (
        <ViewContainer>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Extra children (like hidden WebView) */}
            {children}

            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <StackLayout
                    padding={32}
                    backgroundColor={color}
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
                            {title}
                        </Typography>
                        <Typography variant="h5" style={{ color: "#FFFFFF", lineHeight: 22, fontSize: 18 }}>
                            {subtitle}
                        </Typography>
                    </StackLayout>
                </StackLayout>

                {/* Content */}
                {isLoading ? (
                    <StackLayout style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} gap={20}>
                        <ActivityIndicator size="large" color={color} />
                        <Typography variant="body1" style={{ opacity: 0.7 }}>{loadingText}</Typography>
                    </StackLayout>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <StackLayout
                                style={{ flex: 1, padding: 20, paddingTop: 40 }}
                                gap={16}
                            >
                                <OnboardingInput
                                    placeholder={t("INPUT_MAIL")}
                                    text={username}
                                    setText={setUsername}
                                    icon="User"
                                    inputProps={{
                                        autoCapitalize: "none",
                                        autoCorrect: false,
                                        textContentType: "username"
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
                                        textContentType: "password"
                                    }}
                                />

                                <Button
                                    title={t("LOGIN_BTN")}
                                    onPress={onLogin}
                                    style={{ backgroundColor: color, marginTop: 10 }}
                                    size="large"
                                />

                                <Typography variant="caption" style={{ textAlign: 'center', opacity: 0.5, marginTop: 10 }}>
                                    {t("Onboarding_Login_Subtitle")}
                                </Typography>
                            </StackLayout>
                        </ScrollView>
                    </KeyboardAvoidingView>
                )}
            </View>

            {!isLoading && <OnboardingBackButton />}
        </ViewContainer>
    );
}
