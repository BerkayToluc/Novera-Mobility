import type { AdminSummary } from "@/lib/api-admin";

// The sample numbers of the summary (USE_MOCKS=1). Two of the cards are `null` on purpose, like the API's answer before
// V2-32 and V2-41, so the screen is walked in the state it really has.
export const MOCK_ADMIN_SUMMARY: AdminSummary = {
  date: "2026-10-29",
  rentalsStartingToday: 4,
  rentalsEndingToday: 2,
  reservationsLast7Days: 17,
  quotesAwaiting: 3,
  unhandledMessages: null,
  serviceRequests: null,
};
