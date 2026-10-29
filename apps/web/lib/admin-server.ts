import "server-only";
import type { AdminListParams } from "./admin-query";
import { toApiQuery } from "./admin-query";
import { PROMO_API_FILTERS, type PromoCode, type PromoCodePage } from "./admin-promo";
import { fetchAdminSummary, fetchPromoCode, fetchPromoCodes, type AdminSummary } from "./api-admin";
import { isMockMode } from "./mode";
import { normalizePromo } from "./promo-codes";

// What the panel's server pages read. With USE_MOCKS=1 (local work and tests only, lib/mode.ts) the sample data is
// shown; otherwise these are the API's own answers. They live here, not in api-admin.ts, to keep the sample data out of
// the file that talks to the API (the same split as account-server.ts).
export async function getAdminSummary(): Promise<AdminSummary> {
  if (!isMockMode()) return fetchAdminSummary();
  return (await import("@/mocks/admin")).MOCK_ADMIN_SUMMARY;
}

export async function getPromoCodes(params: AdminListParams<"durum">): Promise<PromoCodePage> {
  if (!isMockMode()) return fetchPromoCodes(toApiQuery(params, PROMO_API_FILTERS));
  return (await import("@/mocks/promo-codes")).listMockPromoCodes({
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    status: params.filters.durum ?? null,
  });
}

// `null` for a code that does not exist, or that cannot be one.
export async function getPromoCode(raw: string): Promise<PromoCode | null> {
  const code = normalizePromo(raw);
  if (!code) return null;
  if (!isMockMode()) return fetchPromoCode(code);
  return (await import("@/mocks/promo-codes")).getMockPromoCode(code);
}
