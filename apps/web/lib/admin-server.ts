import "server-only";
import { fetchAdminSummary, type AdminSummary } from "./api-admin";
import { isMockMode } from "./mode";

// What the panel's server pages read. With USE_MOCKS=1 (local work and tests only, lib/mode.ts) the sample numbers are
// shown; otherwise these are the API's own answers. They live here, not in api-admin.ts, to keep the sample data out of
// the file that talks to the API (the same split as account-server.ts).
export async function getAdminSummary(): Promise<AdminSummary> {
  if (!isMockMode()) return fetchAdminSummary();
  return (await import("@/mocks/admin")).MOCK_ADMIN_SUMMARY;
}
