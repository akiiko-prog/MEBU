import { useTranslation } from "react-i18next";

export function formatDuration(seconds: number): string {
  const { t } = useTranslation();
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) { return `${hours}h ${minutes} ${minutes > 1 ? "mins" : "min"}`; }
  if (hours) { return `${hours} ${t("Course_Hour")}${hours > 1 ? "s" : ""}`; }
  return `${minutes} ${minutes > 1 ? "mins" : "min"}`;
}