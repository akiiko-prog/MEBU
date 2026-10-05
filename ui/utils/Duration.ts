import { t } from "i18next";

// Pas de hook ici : la fonction est appelée dans des useMemo et des rendus
// conditionnels, où useTranslation casse l'ordre des hooks
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) { return `${hours}h ${minutes} ${minutes > 1 ? "mins" : "min"}`; }
  if (hours) { return `${hours} ${t("Course_Hour")}${hours > 1 ? "s" : ""}`; }
  return `${minutes} ${minutes > 1 ? "mins" : "min"}`;
}
