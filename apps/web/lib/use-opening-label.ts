import { useLocale, useTranslations } from "next-intl";
import type { OpeningHours } from "./branch-detail";
import { openingStatus } from "./opening-status";

// The words for a branch's opening status ("7/24 açık", "Şu an açık · kapanış 20:00", "Kapalı ·
// açılış yarın 09:00"), in the visitor's language. `open` says whether to show it as open.
export function useOpeningLabel() {
  const t = useTranslations("RentalSearch.status");
  const locale = useLocale();

  // A date that falls on the weekday, for the day's name in the visitor's language.
  const dayName = (weekday: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));

  return (hours: OpeningHours, now: Date): { text: string; open: boolean } => {
    const result = openingStatus(hours, now);
    if (result.state === "always") return { text: t("always"), open: true };
    if (result.state === "open") return { text: t("open", { time: result.until }), open: true };
    if (result.state === "closed-for-good") return { text: t("closedForGood"), open: false };
    const when = result.daysAhead === 0 ? t("today") : result.daysAhead === 1 ? t("tomorrow") : dayName(result.weekday);
    return { text: t("closed", { when, time: result.opensAt }), open: false };
  };
}
