import "server-only";
import type { AdminListParams } from "./admin-query";
import {
  ASSIGNMENT_API_VALUES,
  EMPLOYEE_API_VALUES,
  VEHICLE_API_VALUES,
  type AssignmentFilter,
  type ContractFilter,
  type EmployeeFilter,
  type FleetAssignmentPage,
  type FleetContractDetail,
  type FleetContractPage,
  type FleetEmployee,
  type FleetEmployeePage,
  type FleetSummary,
  type FleetVehicleDetail,
  type FleetVehiclePage,
  type VehicleFilter,
} from "./fleet-panel";
import { FLEET_EXPENSE_API_FILTERS, type ExpenseStatus, type ExpenseType, type FleetExpenseFilter, type FleetExpensePage } from "./expenses";
import type { Invoice, InvoiceFilter, InvoicePage } from "./invoices";
import { fetchFleetRoute, fetchFleetTracking, fetchFleetRequest, fetchFleetRequests, fetchFleetGreen, fetchFleetReport, fetchFleetStations, fetchFleetAssignments, fetchFleetExpenses, fetchFleetInvoice, fetchFleetInvoices, fetchFleetContract, fetchFleetContracts, fetchFleetEmployee, fetchFleetEmployees, fetchFleetSummary, fetchFleetVehicle, fetchFleetVehicles } from "./api-fleet";
import type { FleetReport } from "./report-calc";
import type { GreenReport, StationList } from "./green";
import type { RouteDay, TrackingList } from "./tracking";
import { requestApiFilters, type RequestFilter, type ServiceRequestDetail, type ServiceRequestPage } from "./requests";
import { isMockMode } from "./mode";
import { mockNow, mockWorld } from "./mock-world";
import { getSession } from "./session";

// What the Filom screens read (V2-36). With USE_MOCKS=1 (local work and tests only, lib/mode.ts) the sample fleet is shown; otherwise
// these are the API's own answers. They live here, not in api-fleet.ts, to keep the sample data out of the file that talks to the API.
// The API knows the company from the session; the sample needs it said (the sample account has one).
async function sampleCompany(): Promise<string> {
  return (await getSession())?.company?.id ?? "none";
}

// The query for the API: its page, size, order and words, and the filters under the API's own names and values.
function apiQuery<F extends string>(params: AdminListParams<F>, map: Partial<Record<F, { name: string; values: Record<string, string> }>>): URLSearchParams {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.sort) query.set("sort", `${params.sort.key}:${params.sort.dir}`);
  if (params.q) query.set("q", params.q);
  for (const [name, value] of Object.entries(params.filters) as Array<[F, string]>) {
    const entry = map[name];
    if (entry && entry.values[value] !== undefined) query.set(entry.name, entry.values[value]);
    else if (!entry) query.set(name, value);
  }
  return query;
}

const flag = (value: string | undefined, yes: string): boolean | null => (value === undefined ? null : value === yes);

export async function getFleetSummary(): Promise<FleetSummary> {
  if (!isMockMode()) return fetchFleetSummary();
  return (await import("@/mocks/fleet-panel")).fleetSummary(await mockWorld(), await sampleCompany());
}

export async function getFleetVehicles(params: AdminListParams<VehicleFilter>): Promise<FleetVehiclePage> {
  if (!isMockMode()) return fetchFleetVehicles(apiQuery(params, VEHICLE_API_VALUES));
  return (await import("@/mocks/fleet-panel")).listFleetVehicles(await mockWorld(), await sampleCompany(), {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    status: params.filters.durum === undefined ? null : VEHICLE_API_VALUES.durum.values[params.filters.durum as "kullanimda"],
    assigned: flag(params.filters.zimmet, "zimmetli"),
  });
}

// `null` for a car that does not exist, is another company's, or whose plate cannot be one.
export async function getFleetVehicle(plate: string): Promise<FleetVehicleDetail | null> {
  if (!isMockMode()) return fetchFleetVehicle(plate);
  return (await import("@/mocks/fleet-panel")).getFleetVehicle(await mockWorld(), await sampleCompany(), plate);
}

export async function getFleetContracts(params: AdminListParams<ContractFilter>): Promise<FleetContractPage> {
  if (!isMockMode()) return fetchFleetContracts(apiQuery(params, {}));
  return (await import("@/mocks/fleet-panel")).listFleetContracts(await mockWorld(), await sampleCompany(), { page: params.page, pageSize: params.pageSize, sort: params.sort, status: params.filters.durum ?? null });
}

export async function getFleetContract(number: string): Promise<FleetContractDetail | null> {
  if (!isMockMode()) return fetchFleetContract(number);
  return (await import("@/mocks/fleet-panel")).getFleetContract(await mockWorld(), await sampleCompany(), number);
}

export async function getFleetEmployees(params: AdminListParams<EmployeeFilter>): Promise<FleetEmployeePage> {
  if (!isMockMode()) return fetchFleetEmployees(apiQuery(params, EMPLOYEE_API_VALUES));
  return (await import("@/mocks/fleet-panel")).listFleetEmployees(await mockWorld(), await sampleCompany(), { page: params.page, pageSize: params.pageSize, sort: params.sort, q: params.q, active: flag(params.filters.durum, "aktif") });
}

export async function getFleetEmployee(id: string): Promise<FleetEmployee | null> {
  if (!isMockMode()) return fetchFleetEmployee(id);
  return (await import("@/mocks/fleet-panel")).getFleetEmployee(await mockWorld(), await sampleCompany(), id);
}

export async function getFleetAssignments(params: AdminListParams<AssignmentFilter>): Promise<FleetAssignmentPage> {
  if (!isMockMode()) return fetchFleetAssignments(apiQuery(params, ASSIGNMENT_API_VALUES));
  return (await import("@/mocks/fleet-panel")).listFleetAssignments(await mockWorld(), await sampleCompany(), { page: params.page, pageSize: params.pageSize, vehicle: null, employee: null, open: flag(params.filters.durum, "acik") });
}

export async function getFleetInvoices(params: AdminListParams<InvoiceFilter>): Promise<InvoicePage> {
  if (!isMockMode()) return fetchFleetInvoices(apiQuery(params, { durum: { name: "status", values: { PAID: "PAID", PENDING: "PENDING", OVERDUE: "OVERDUE" } } }));
  return (await import("@/mocks/invoices")).listMockInvoices(
    await mockWorld(),
    { page: params.page, pageSize: params.pageSize, sort: params.sort, q: "", status: (params.filters.durum as Invoice["status"] | undefined) ?? null },
    await sampleCompany(),
  );
}

// `null` for an invoice that does not exist, is another company's, or whose number cannot be one.
export async function getFleetInvoice(number: string): Promise<Invoice | null> {
  if (!isMockMode()) return fetchFleetInvoice(number);
  return (await import("@/mocks/invoices")).getMockInvoice(await mockWorld(), number, await sampleCompany());
}

// The person filter is a person's id, or `yok` (in the address) for the expenses of a moment nobody had the car: `none` for the API.
export async function getFleetExpenses(params: AdminListParams<FleetExpenseFilter>): Promise<FleetExpensePage> {
  const f = params.filters;
  if (!isMockMode()) {
    const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
    if (params.sort) query.set("sort", `${params.sort.key}:${params.sort.dir}`);
    for (const [name, value] of Object.entries(f) as Array<[FleetExpenseFilter, string]>) query.set(FLEET_EXPENSE_API_FILTERS[name], name === "personel" && value === "yok" ? "none" : value);
    return fetchFleetExpenses(query);
  }
  return (await import("@/mocks/expenses")).listMockExpenses(
    await mockWorld(),
    {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      type: (f.tur as ExpenseType | undefined) ?? null,
      status: (f.durum as ExpenseStatus | undefined) ?? null,
      employee: f.personel === "yok" ? "none" : (f.personel ?? null),
      vehicle: f.arac ?? null,
      from: f.bas ?? null,
      to: f.bit ?? null,
    },
    await sampleCompany(),
  );
}

// The report of the company for the months from `from` to `to` ("2026-08"), both included.
export async function getFleetReport(from: string, to: string): Promise<FleetReport> {
  if (!isMockMode()) return fetchFleetReport(from, to);
  return (await import("@/mocks/reports")).sampleReport(await mockWorld(), await sampleCompany(), from, to);
}

// The service requests of the company; `vehicle` narrows to one car's.
export async function getFleetRequests(params: AdminListParams<RequestFilter>, vehicle: string | null = null): Promise<ServiceRequestPage> {
  if (!isMockMode()) {
    const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
    if (params.sort) query.set("sort", `${params.sort.key}:${params.sort.dir}`);
    for (const [name, value] of Object.entries(requestApiFilters(params.filters))) query.set(name, String(value));
    if (vehicle) query.set("vehicle", vehicle);
    return fetchFleetRequests(query);
  }
  return (await import("@/mocks/requests")).listMockRequests(await mockWorld(), { page: params.page, pageSize: params.pageSize, sort: params.sort, filters: params.filters, vehicle }, await sampleCompany());
}

// `null` for a request that does not exist, is another company's, or whose number cannot be one.
export async function getFleetRequest(number: string): Promise<ServiceRequestDetail | null> {
  if (!isMockMode()) return fetchFleetRequest(number);
  return (await import("@/mocks/requests")).getMockRequest(await mockWorld(), number, await sampleCompany());
}

// The electric and hybrid cars of the company for the months from `from` to `to`, with the carbon they saved.
export async function getFleetGreen(from: string, to: string): Promise<GreenReport> {
  if (!isMockMode()) return fetchFleetGreen(from, to);
  return (await import("@/mocks/green")).sampleGreen(await mockWorld(), await sampleCompany(), from, to);
}

// The charging stations nearest to a car (a simulation); `null` for a car that does not exist, is another company's or is not electric or hybrid.
export async function getFleetStations(plate: string, limit: number): Promise<StationList | null> {
  if (!isMockMode()) return fetchFleetStations(plate, limit);
  return (await import("@/mocks/green")).sampleStations(await mockWorld(), await sampleCompany(), plate, limit);
}

// Where the cars are now (a simulation, ADR-30).
export async function getFleetTracking(): Promise<TrackingList> {
  if (!isMockMode()) return fetchFleetTracking();
  return (await import("@/mocks/tracking")).sampleTracking(await mockWorld(), await sampleCompany(), await mockNow());
}

// The route of a car on a day (a simulation); `null` for a car that does not exist, is another company's or was given back. `date` must be one the
// route can be asked for (lib/tracking.ts `pickDay`).
export async function getFleetRoute(plate: string, date: string): Promise<RouteDay | null> {
  if (!isMockMode()) return fetchFleetRoute(plate, date);
  const route = (await import("@/mocks/tracking")).sampleRoute(await mockWorld(), await sampleCompany(), plate, date, await mockNow());
  return route === "out_of_range" ? null : route;
}

// The people a car can be given to: the active ones, by surname, for the form's choice (a company has a few dozen at most).
export async function getAssignableEmployees(): Promise<FleetEmployee[]> {
  const params: AdminListParams<EmployeeFilter> = { page: 1, pageSize: 100, sort: { key: "lastName", dir: "asc" }, q: "", filters: { durum: "aktif" } };
  return (await getFleetEmployees(params)).items;
}
