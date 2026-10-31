import type { AdminSummary } from "@/lib/api-admin";

// The sample numbers of the summary (USE_MOCKS=1). The three waiting quotes, the four waiting messages and the four service requests that
// are not over are the ones in the sample fleet (mocks/fleet-world.ts, mocks/requests.ts); a test keeps them in step.
export const MOCK_ADMIN_SUMMARY: AdminSummary = {
  date: "2026-10-29",
  rentalsStartingToday: 4,
  rentalsEndingToday: 2,
  reservationsLast7Days: 17,
  quotesAwaiting: 3,
  unhandledMessages: 4,
  serviceRequests: 4,
};
