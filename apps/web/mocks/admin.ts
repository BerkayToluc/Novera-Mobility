import type { AdminSummary } from "@/lib/api-admin";

// The sample numbers of the summary (USE_MOCKS=1). The service requests card is `null` on purpose, like the API's answer before
// V2-41, so the screen is walked in the state it really has. The three waiting quotes and four waiting messages are the ones in
// the sample fleet (mocks/fleet-world.ts); a test keeps them in step.
export const MOCK_ADMIN_SUMMARY: AdminSummary = {
  date: "2026-10-29",
  rentalsStartingToday: 4,
  rentalsEndingToday: 2,
  reservationsLast7Days: 17,
  quotesAwaiting: 3,
  unhandledMessages: 4,
  serviceRequests: null,
};
