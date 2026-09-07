import { useTheme } from "@react-navigation/native";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";

const AURIGA_COLOR = "#0078D4";
const AURIGA_URL = "https://my.esme.fr/";

export default function NeedHelpAuriga() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = React.useState(Platform.OS === "android");

  const steps = React.useMemo(() => [
    {
      number: "1",
      title: t("NeedHelpAuriga_Step1_Title"),
      description: t("NeedHelpAuriga_Step1_Description"),
      action: {
        label: t("NeedHelpAuriga_Step1_Action"),
        url: AURIGA_URL,
      },
    },
    {
      number: "2",
      title: t("NeedHelpAuriga_Step2_Title"),
      description: t("NeedHelpAuriga_Step2_Description"),
    },
    {
      number: "3",
      title: t("NeedHelpAuriga_Step3_Title"),
      description: t("NeedHelpAuriga_Step3_Description"),
    },
  ], [t]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={AURIGA_COLOR} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: AURIGA_COLOR,
            borderRadius: 20,
            borderCurve: "continuous",
            padding: 24,
            marginBottom: 24,
            alignItems: "center",
          }}
        >
          <Typography
            variant="h3"
            style={{ color: "white", textAlign: "center", marginBottom: 6 }}
          >
            {t("NeedHelpAuriga_Hero_Title")}
          </Typography>
          <Typography
            variant="caption"
            style={{ color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 20 }}
          >
            {t("NeedHelpAuriga_Hero_Subtitle")}
          </Typography>
        </View>

        <Stack
          card
          style={{
            marginBottom: 24,
            padding: 16,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            backgroundColor: AURIGA_COLOR + "15",
            borderColor: AURIGA_COLOR + "40",
            borderWidth: 1,
          }}
        >
          <Typography
            variant="caption"
            style={{ flex: 1, color: colors.text, lineHeight: 20 }}
          >
            {t("NeedHelpAuriga_Info_Part1")}
            <Typography variant="caption" weight="semibold">{t("NeedHelpAuriga_Info_Bold")}</Typography>
            {t("NeedHelpAuriga_Info_Part2")}
          </Typography>
        </Stack>

        <Typography
          variant="h5"
          style={{ marginBottom: 16, color: colors.text }}
        >
          {t("NeedHelpAuriga_HowTo_Title")}
        </Typography>

        {steps.map((step, index) => (
          <View key={index} style={{ marginBottom: 16 }}>
            <Stack card style={{ padding: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 12 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: AURIGA_COLOR,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="body2"
                    style={{ color: "white", lineHeight: 18 }}
                  >
                    {step.number}
                  </Typography>
                </View>
                <Typography variant="title" style={{ flex: 1, color: colors.text }}>
                  {step.title}
                </Typography>
              </View>
              <Typography
                variant="caption"
                style={{ color: colors.text, opacity: 0.7, lineHeight: 20, marginBottom: step.action ? 14 : 0 }}
              >
                {step.description}
              </Typography>
              {step.action && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(step.action!.url)}
                  style={{
                    backgroundColor: AURIGA_COLOR,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    alignItems: "center",
                  }}
                  activeOpacity={0.75}
                >
                  <Typography
                    variant="caption"
                    weight="semibold"
                    style={{ color: "white" }}
                  >
                    {step.action.label}
                  </Typography>
                </TouchableOpacity>
              )}
            </Stack>
          </View>
        ))}

        <Typography
          variant="caption"
          style={{ color: colors.text, opacity: 0.4, textAlign: "center", marginTop: 8, lineHeight: 18, marginBottom: 33 }}
        >
          {t("NeedHelpAuriga_ContactSupport")}
        </Typography>
      </ScrollView>
    </>
  );
}
