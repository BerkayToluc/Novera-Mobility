import "server-only";
import type { AdminListParams } from "./admin-query";
import { toApiQuery } from "./admin-query";
import { MODEL_API_FILTERS, type AdminModelDetail, type AdminModelPage, type ModelClass } from "./admin-models";
import { BRANCH_API_FILTERS, type AdminBranchDetail, type AdminBranchPage } from "./admin-branches";
import { PROMO_API_FILTERS, type PromoCode, type PromoCodePage } from "./admin-promo";
import { fetchAdminBranch, fetchAdminBranches, fetchAdminModel, fetchAdminModels, fetchAdminSummary, fetchModelClasses, fetchPromoCode, fetchPromoCodes, type AdminSummary } from "./api-admin";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
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

export async function getAdminBranches(params: AdminListParams<"sehir" | "durum">): Promise<AdminBranchPage> {
  if (!isMockMode()) return fetchAdminBranches(toApiQuery(params, BRANCH_API_FILTERS));
  return (await import("@/mocks/branches")).listMockBranches(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    city: params.filters.sehir ?? null,
    status: params.filters.durum ?? null,
  });
}

// `null` for a branch that does not exist, or whose id cannot be one.
export async function getAdminBranch(id: string): Promise<AdminBranchDetail | null> {
  if (!isMockMode()) return fetchAdminBranch(id);
  return (await import("@/mocks/branches")).getMockBranch(await mockWorld(), id);
}

export async function getAdminModels(params: AdminListParams<"sinif" | "yakit" | "durum">): Promise<AdminModelPage> {
  if (!isMockMode()) return fetchAdminModels(toApiQuery(params, MODEL_API_FILTERS));
  return (await import("@/mocks/models")).listMockModels(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    classSlug: params.filters.sinif ?? null,
    fuel: params.filters.yakit ?? null,
    status: params.filters.durum ?? null,
  });
}

// `null` for a model that does not exist, or whose address cannot be one.
export async function getAdminModel(slug: string): Promise<AdminModelDetail | null> {
  if (!isMockMode()) return fetchAdminModel(slug);
  return (await import("@/mocks/models")).getMockModel(await mockWorld(), slug);
}

export async function getModelClasses(): Promise<ModelClass[]> {
  if (!isMockMode()) return fetchModelClasses();
  return (await import("@/mocks/models")).mockClasses();
}
