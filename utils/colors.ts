import { useTranslation } from "react-i18next";
const { t } = useTranslation()

export enum Colors {
  PINK,
  YELLOW,
  GREEN,
  PURPLE,
  BLUE,
  BLACK,
}

export const AppColors = [
  {
    mainColor: "#DD007D",
    backgroundColor: "#FAD9EC",
    nameKey: t("ONBOARDING_COLOR_PINK"),
    colorEnum: Colors.PINK,
  },
  {
    mainColor: "#E8B048",
    backgroundColor: "#FCF3E4",
    nameKey: t("ONBOARDING_COLOR_YELLOW"),
    colorEnum: Colors.YELLOW,
  },
  {
    mainColor: "#26B290",
    backgroundColor: "#DEF3EE",
    nameKey: t("ONBOARDING_COLOR_GREEN"),
    colorEnum: Colors.GREEN,
  },
  {
    mainColor: "#C400DD",
    backgroundColor: "#F6D9FA",
    nameKey: t("ONBOARDING_COLOR_PURPLE"),
    colorEnum: Colors.PURPLE,
  },
  {
    mainColor: "#48B7E8",
    backgroundColor: "#E4F4FC",
    nameKey: t("ONBOARDING_COLOR_BLUE"),
    colorEnum: Colors.BLUE,
  },
  {
    mainColor: "#6D6D6D",
    backgroundColor: "#E9E9E9",
    nameKey: t("ONBOARDING_COLOR_BLACK"),
    colorEnum: Colors.BLACK,
  },
];
