import type { AdminScreenKey } from "./admin-screens";
import type { AdminSummary } from "./api-admin";

// One card of the summary: which number it shows, which list it opens and how that list is narrowed. The list screens
// (V2-31 reservations, V2-32 quotes and messages, V2-41 requests) read these filters from the address; until a screen is
// built (ready in lib/admin-screens.ts) its card is a number without a link.
export type SummaryCardKey =
  | "rentalsStartingToday"
  | "rentalsEndingToday"
  | "reservationsLast7Days"
  | "quotesAwaiting"
  | "unhandledMessages"
  | "serviceRequests";

export const SUMMARY_CARDS: readonly { key: SummaryCardKey; screen: AdminScreenKey; filter: Record<string, string> }[] = [
  { key: "rentalsStartingToday", screen: "reservations", filter: { baslangic: "bugun" } },
  { key: "rentalsEndingToday", screen: "reservations", filter: { bitis: "bugun" } },
  { key: "reservationsLast7Days", screen: "reservations", filter: { olusturma: "7gun" } },
  { key: "quotesAwaiting", screen: "quotes", filter: { durum: "RECEIVED" } },
  { key: "unhandledMessages", screen: "messages", filter: { durum: "ele-alinmadi" } },
  { key: "serviceRequests", screen: "requests", filter: { durum: "acik" } },
];

// A number that is null has no source yet (the API says so): its card is left out, not shown as a wrong zero.
export const shownCards = (summary: AdminSummary) => SUMMARY_CARDS.filter(({ key }) => summary[key] !== null);

// "All clear": nothing to look at in any card that is shown.
export const summaryIsEmpty = (summary: AdminSummary): boolean => shownCards(summary).every(({ key }) => summary[key] === 0);
