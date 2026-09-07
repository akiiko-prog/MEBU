import { Papicons } from "@getpapillon/papicons"
import { CommonActions, useTheme } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Platform, StyleSheet, View } from "react-native";
import Reanimated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppColorsSelector from "@/components/AppColorsSelector";
import { initializeAccountManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import Button from "@/ui/components/Button";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import adjust from "@/utils/adjustColor";
import { AppColors } from "@/utils/colors";

const colorToImageMap: Record<string, any> = {
  "#DD007D": require("@/assets/images/pink.png"),
  "#E8B048": require("@/assets/images/yellow.png"),
  "#26B290": require("@/assets/images/green.png"),
  "#C400DD": require("@/assets/images/purple.png"),
  "#48B7E8": require("@/assets/images/blue.png"),
  "#6D6D6D": require("@/assets/images/grey.png"),
};

export default function ChooseColorScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets()

  const local = useLocalSearchParams()
  const navigation = useNavigation();

  const accountStore = useAccountStore.getState();
  const lastUsedAccount = accountStore.accounts.find(account => account.id === accountStore.lastUsedAccount);

  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const defaultColorData = useMemo(() =>
    AppColors.find(color => color.colorEnum === settingsStore.colorSelected) || AppColors[0],
    [settingsStore.colorSelected]
  );

  const [selectedColor, setSelectedColor] = useState<string>(defaultColorData.mainColor);
  const [animationEnded, setAnimationEnded] = useState(false);

  const accountId = local.accountId ? String(local.accountId) : lastUsedAccount?.id;

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);

    setTimeout(() => {
      const colorData = AppColors.find(appColor => appColor.mainColor === color);
      if (colorData) {
        mutateProperty('personalization', {
          colorSelected: colorData.colorEnum
        });
      }
    }, 50);
  }, [mutateProperty]);

  const { t } = useTranslation();

  const gradientColors = useMemo(() => [selectedColor, selectedColor] as const, [selectedColor]);
  const gradientKey = useMemo(() => `gradient:${selectedColor}`, [selectedColor]);

  return (
    <View style={{ ...styles.container, marginBottom: insets.bottom }}>
      <Reanimated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(100)}
        key={gradientKey}
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      <LinearGradient
        colors={[colors.background + "00", colors.background]}
        locations={[0.0498, 0.8193]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Reanimated.View style={{
        padding: 20,
        paddingTop: insets.top + 20,
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
        entering={Platform.OS === "android" ? undefined : ZoomIn.springify().duration(300)}
        exiting={Platform.OS === "android" ? undefined : FadeOut.duration(100)}
      >
        <Reanimated.Image
          key={`image:${selectedColor}`}
          entering={ZoomIn.duration(200)}
          exiting={ZoomOut.duration(200)}
          source={colorToImageMap[selectedColor]}
          style={{ width: 150, height: 150, resizeMode: "contain" }}
        />
      </Reanimated.View>
      <View style={{ paddingHorizontal: 20, gap: 22, paddingBottom: 20 }}>
        <View>
          <Typography color={adjust(selectedColor, theme.dark ? 0.7 : -0.5)} variant="h4">{t("ONBOARDING_COLOR_TITLE")}</Typography>
          <Stack gap={0}>
            <Typography color={adjust(selectedColor, theme.dark ? 0.7 : -0.5)} variant="h2">{t("ONBOARDING_COLOR_FIRST_LINE_DESCRIPTION")}</Typography>
            <Typography style={{ marginBottom: -5 }} color={adjust(selectedColor, theme.dark ? 0.7 : -0.5)} variant="h2">{t("ONBOARDING_COLOR_SECOND_LINE_DESCRIPTION")}</Typography>
          </Stack>
        </View>
        <AppColorsSelector
          onChangeColor={handleColorChange}
          accountId={accountId}
        />
        <Typography
          style={{ paddingTop: 10, marginTop: -20 }}
          color="#7F7F7F"
          variant="caption"
        >
          {t("Settings_Personalization_Accent_Description")}
        </Typography>
        <Button
          title="Terminer"
          onPress={async () => {
            if (accountId) {
              try {
                // Ensure the account store has this selected as the last used account
                useAccountStore.getState().setLastUsedAccount(accountId);
                await initializeAccountManager(accountId);
              } catch (e) {
                console.error("Failed to initialize account manager:", e);
              }
              setTimeout(() => {
                navigation.getParent()?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: '(tabs)' }],
                  })
                );
              }, 100);
            }
          }}
          style={{
            backgroundColor: theme.dark ? colors.border : "black",
            alignSelf: "center"
          }}
          size='large'
          icon={
            <Icon papicon size={24} fill={"white"} style={{ backgroundColor: "transparent" }}>
              <Papicons name={"Butterfly"} />
            </Icon>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});
