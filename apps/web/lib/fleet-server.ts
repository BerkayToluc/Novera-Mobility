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
import type { Invoice, InvoiceFilter, InvoicePage } from "./invoices";
import { fetchFleetAssignments, fetchFleetInvoice, fetchFleetInvoices, fetchFleetContract, fetchFleetContracts, fetchFleetEmployee, fetchFleetEmployees, fetchFleetSummary, fetchFleetVehicle, fetchFleetVehicles } from "./api-fleet";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
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

// The people a car can be given to: the active ones, by surname, for the form's choice (a company has a few dozen at most).
export async function getAssignableEmployees(): Promise<FleetEmployee[]> {
  const params: AdminListParams<EmployeeFilter> = { page: 1, pageSize: 100, sort: { key: "lastName", dir: "asc" }, q: "", filters: { durum: "aktif" } };
  return (await getFleetEmployees(params)).items;
}
