import "server-only";
import type { AdminListParams } from "./admin-query";
import { toApiQuery } from "./admin-query";
import { MESSAGE_API_VALUES, type AdminMessageDetail, type AdminMessagePage } from "./admin-messages";
import { QUOTE_API_FILTERS, type AdminQuoteDetail, type AdminQuotePage } from "./admin-quotes";
import type { AdminExtra } from "./admin-extras";
import { QUICK_API_VALUES, RESERVATION_API_FILTERS, validDay, type ReservationFilter, type AdminReservationDetail, type AdminReservationPage } from "./admin-reservations";
import { VEHICLE_API_FILTERS, type AdminVehicleDetail, type AdminVehiclePage, type BranchOption, type ModelOption } from "./admin-vehicles";
import { MODEL_API_FILTERS, type AdminModelDetail, type AdminModelPage, type ModelClass } from "./admin-models";
import { BRANCH_API_FILTERS, type AdminBranchDetail, type AdminBranchPage } from "./admin-branches";
import { PROMO_API_FILTERS, type PromoCode, type PromoCodePage } from "./admin-promo";
import type { AdminCompanyDetail, AdminCompanyPage } from "./admin-companies";
import { AUDIT_API_FILTERS, validActor, type AdminAuditPage, type AuditFilter } from "./admin-audit";
import { requestApiFilters, type RequestFilter, type ServiceRequestDetail, type ServiceRequestPage } from "./requests";
import { EXPENSE_API_FILTERS, type ExpenseFilter, type ExpenseStatus, type ExpenseType, type FleetExpensePage } from "./expenses";
import { INVOICE_API_FILTERS, type Invoice, type InvoiceFilter, type InvoicePage } from "./invoices";
import { USER_API_FILTERS, type AdminUserDetail, type AdminUserPage, type UserFilter } from "./admin-users";
import type { FleetContract, FleetContractDetail } from "./admin-contracts";
import { fetchAdminContract, fetchAdminExpenses, fetchAdminRequest, fetchAdminRequests, fetchAdminInvoice, fetchAdminInvoices, fetchCompanyContracts, fetchAdminAudit, fetchAdminUser, fetchAdminUsers, fetchAdminBranch, fetchAdminCompanies, fetchAdminCompany, fetchAdminBranches, fetchAdminExtra, fetchAdminExtras, fetchAdminModel, fetchAdminMessage, fetchAdminMessages, fetchAdminModels, fetchAdminQuote, fetchAdminQuotes, fetchAdminReservation, fetchAdminReservations, fetchAdminSummary, fetchAdminVehicle, fetchAdminVehicles, fetchModelClasses, fetchPromoCode, fetchPromoCodes, type AdminSummary } from "./api-admin";
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

export async function getAdminVehicles(params: AdminListParams<"model" | "bayi" | "durum">): Promise<AdminVehiclePage> {
  if (!isMockMode()) return fetchAdminVehicles(toApiQuery(params, VEHICLE_API_FILTERS));
  return (await import("@/mocks/vehicles")).listMockVehicles(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    model: params.filters.model ?? null,
    branch: params.filters.bayi ?? null,
    status: params.filters.durum ?? null,
  });
}

// `null` for a car that does not exist, or whose id cannot be one.
export async function getAdminVehicle(id: string): Promise<AdminVehicleDetail | null> {
  if (!isMockMode()) return fetchAdminVehicle(id);
  return (await import("@/mocks/vehicles")).getMockVehicle(await mockWorld(), id);
}

// The models a car can be added to (the ones on the site), for the form's choice and the list's filter.
export async function getModelOptions(includeRetired = false): Promise<ModelOption[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "100", sort: "name:asc" });
  if (!includeRetired) query.set("status", "ACTIVE");
  const page = isMockMode()
    ? (await import("@/mocks/models")).listMockModels(await mockWorld(), { page: 1, pageSize: 100, sort: { key: "name", dir: "asc" }, q: "", classSlug: null, fuel: null, status: includeRetired ? null : "ACTIVE" })
    : await fetchAdminModels(query);
  return page.items.map((row) => ({ slug: row.slug, label: `${row.brand} ${row.model}` }));
}

// The branches a car can be put in (the open ones), for the form's choice and the list's filter.
export async function getBranchOptions(includeClosed = false): Promise<BranchOption[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "100", sort: "name:asc" });
  if (!includeClosed) query.set("status", "OPEN");
  const page = isMockMode()
    ? (await import("@/mocks/branches")).listMockBranches(await mockWorld(), { page: 1, pageSize: 100, sort: { key: "name", dir: "asc" }, q: "", city: null, status: includeClosed ? null : "OPEN" })
    : await fetchAdminBranches(query);
  return page.items.map((row) => ({ id: row.id, label: `${row.name} (${row.city})` }));
}

export async function getAdminExtras(): Promise<AdminExtra[]> {
  if (!isMockMode()) return fetchAdminExtras();
  return (await import("@/mocks/extras")).listMockExtras(await mockWorld());
}

// `null` for an extra that does not exist.
export async function getAdminExtra(slug: string): Promise<AdminExtra | null> {
  if (!isMockMode()) return fetchAdminExtra(slug);
  return (await import("@/mocks/extras")).getMockExtra(await mockWorld(), slug);
}

export async function getAdminReservations(params: AdminListParams<ReservationFilter>): Promise<AdminReservationPage> {
  // A day that is not one is left out, so a made-up address shows the list; and a last day before the first is not asked for.
  const from = validDay(params.filters.bas);
  const to = validDay(params.filters.bit);
  const filters = { ...params.filters, bas: from, bit: from && to && to < from ? undefined : to };
  const clean = { ...params, filters };
  if (!isMockMode()) {
    const query = toApiQuery(clean, RESERVATION_API_FILTERS);
    // The three summary windows go with the API's own words for them.
    for (const name of ["baslangic", "bitis", "olusturma"] as const) if (filters[name]) query.set(RESERVATION_API_FILTERS[name], QUICK_API_VALUES[name]);
    return fetchAdminReservations(query);
  }
  return (await import("@/mocks/admin-reservations")).listMockAdminReservations(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    status: filters.durum ?? null,
    branch: filters.bayi ?? null,
    from: filters.bas ?? null,
    to: filters.bit ?? null,
    startsToday: Boolean(filters.baslangic),
    endsToday: Boolean(filters.bitis),
    madeLast7Days: Boolean(filters.olusturma),
  });
}

// `null` for a booking that does not exist, or whose number cannot be one.
export async function getAdminReservation(number: string): Promise<AdminReservationDetail | null> {
  if (!isMockMode()) return fetchAdminReservation(number);
  return (await import("@/mocks/admin-reservations")).getMockAdminReservation(await mockWorld(), number);
}

export async function getAdminQuotes(params: AdminListParams<"durum" | "kaynak">): Promise<AdminQuotePage> {
  if (!isMockMode()) return fetchAdminQuotes(toApiQuery(params, QUOTE_API_FILTERS));
  return (await import("@/mocks/admin-quotes")).listMockQuotes(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    status: params.filters.durum ?? null,
    source: params.filters.kaynak ?? null,
  });
}

// `null` for a request that does not exist, or whose number cannot be one.
export async function getAdminQuote(number: string): Promise<AdminQuoteDetail | null> {
  if (!isMockMode()) return fetchAdminQuote(number);
  return (await import("@/mocks/admin-quotes")).getMockQuote(await mockWorld(), number);
}

export async function getAdminMessages(params: AdminListParams<"durum">): Promise<AdminMessagePage> {
  const state = params.filters.durum as keyof typeof MESSAGE_API_VALUES | undefined;
  if (!isMockMode()) {
    const query = toApiQuery({ ...params, filters: {} });
    if (state) query.set("handled", MESSAGE_API_VALUES[state]);
    return fetchAdminMessages(query);
  }
  return (await import("@/mocks/admin-messages")).listMockMessages(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    handled: state ? state === "ele-alindi" : null,
  });
}

// `null` for a message that does not exist, or whose id cannot be one.
export async function getAdminMessage(id: string): Promise<AdminMessageDetail | null> {
  if (!isMockMode()) return fetchAdminMessage(id);
  return (await import("@/mocks/admin-messages")).getMockMessage(await mockWorld(), id);
}

export async function getAdminCompanies(params: AdminListParams<never>): Promise<AdminCompanyPage> {
  if (!isMockMode()) return fetchAdminCompanies(toApiQuery(params));
  return (await import("@/mocks/admin-companies")).listMockCompanies(await mockWorld(), { page: params.page, pageSize: params.pageSize, sort: params.sort, q: params.q });
}

// `null` for a company that does not exist, or whose id cannot be one.
export async function getAdminCompany(id: string): Promise<AdminCompanyDetail | null> {
  if (!isMockMode()) return fetchAdminCompany(id);
  return (await import("@/mocks/admin-companies")).getMockCompany(await mockWorld(), id);
}

export async function getAdminUsers(params: AdminListParams<UserFilter>): Promise<AdminUserPage> {
  if (!isMockMode()) return fetchAdminUsers(toApiQuery(params, USER_API_FILTERS));
  return (await import("@/mocks/admin-users")).listMockUsers(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    type: params.filters.tur ?? null,
    status: params.filters.durum ?? null,
  });
}

// `null` for an account that does not exist, or whose id cannot be one.
export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  if (!isMockMode()) return fetchAdminUser(id);
  return (await import("@/mocks/admin-users")).getMockUser(await mockWorld(), id);
}

export async function getAdminInvoices(params: AdminListParams<InvoiceFilter>): Promise<InvoicePage> {
  if (!isMockMode()) return fetchAdminInvoices(toApiQuery(params, INVOICE_API_FILTERS));
  return (await import("@/mocks/invoices")).listMockInvoices(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    status: (params.filters.durum as Invoice["status"] | undefined) ?? null,
  });
}

// `null` for an invoice that does not exist, or whose number cannot be one.
export async function getAdminInvoice(number: string): Promise<Invoice | null> {
  if (!isMockMode()) return fetchAdminInvoice(number);
  return (await import("@/mocks/invoices")).getMockInvoice(await mockWorld(), number);
}

export async function getAdminExpenses(params: AdminListParams<ExpenseFilter>): Promise<FleetExpensePage> {
  if (!isMockMode()) return fetchAdminExpenses(toApiQuery(params, EXPENSE_API_FILTERS));
  return (await import("@/mocks/expenses")).listMockExpenses(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    type: (params.filters.tur as ExpenseType | undefined) ?? null,
    status: (params.filters.durum as ExpenseStatus | undefined) ?? null,
  });
}

export async function getAdminRequests(params: AdminListParams<RequestFilter>): Promise<ServiceRequestPage> {
  if (!isMockMode()) {
    const query = toApiQuery({ ...params, filters: {} });
    for (const [name, value] of Object.entries(requestApiFilters(params.filters))) query.set(name, String(value));
    return fetchAdminRequests(query);
  }
  return (await import("@/mocks/requests")).listMockRequests(await mockWorld(), { page: params.page, pageSize: params.pageSize, sort: params.sort, filters: params.filters, q: params.q });
}

// `null` for a request that does not exist, or whose number cannot be one.
export async function getAdminRequest(number: string): Promise<ServiceRequestDetail | null> {
  if (!isMockMode()) return fetchAdminRequest(number);
  return (await import("@/mocks/requests")).getMockRequest(await mockWorld(), number);
}

// A day that is not a real one, or a "who" that cannot be one, is left out, so a made-up address shows the log.
export async function getAdminAudit(params: AdminListParams<AuditFilter>): Promise<AdminAuditPage> {
  const from = validDay(params.filters.bas);
  const to = validDay(params.filters.bit);
  const filters = { ...params.filters, yonetici: validActor(params.filters.yonetici), bas: from, bit: from && to && to < from ? undefined : to };
  if (!isMockMode()) return fetchAdminAudit(toApiQuery({ ...params, filters }, AUDIT_API_FILTERS));
  return (await import("@/mocks/admin-users")).listMockAudit(await mockWorld(), {
    page: params.page,
    pageSize: params.pageSize,
    actor: filters.yonetici ?? null,
    entity: filters.alan ?? null,
    from: filters.bas ?? null,
    to: filters.bit ?? null,
  });
}

// The accounts that can be the "who" of a log line: the administrators, and the terminal.
export async function getAuditActors(): Promise<Array<{ id: string; label: string }>> {
  const page = isMockMode()
    ? null
    : await fetchAdminUsers(new URLSearchParams({ page: "1", pageSize: "100", type: "ADMIN", sort: "lastName:asc" }));
  const admins = page ? page.items.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` })) : (await import("@/mocks/admin-users")).mockAdministrators(await mockWorld());
  return admins;
}

// `null` for a company that does not exist.
export async function getCompanyContracts(companyId: string): Promise<FleetContract[] | null> {
  if (!isMockMode()) return fetchCompanyContracts(companyId);
  return (await import("@/mocks/admin-contracts")).listMockContracts(await mockWorld(), companyId);
}

// `null` for a contract that does not exist, or whose number cannot be one.
export async function getAdminContract(number: string): Promise<FleetContractDetail | null> {
  if (!isMockMode()) return fetchAdminContract(number);
  return (await import("@/mocks/admin-contracts")).getMockContract(await mockWorld(), number);
}
