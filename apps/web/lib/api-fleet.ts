import "server-only";
import { apiRequest } from "./api-request";
import type { FleetExpensePage } from "./expenses";
import type { FleetReport } from "./report-calc";
import type { GreenReport, StationList } from "./green";
import type { RouteDay, TrackingList } from "./tracking";
import type { ServiceRequestDetail, ServiceRequestPage } from "./requests";
import type { Invoice, InvoicePage } from "./invoices";
import type { FleetAssignmentPage, FleetContractDetail, FleetContractPage, FleetEmployee, FleetEmployeePage, FleetSummary, FleetVehicleDetail, FleetVehiclePage } from "./fleet-panel";
import { ApiUnavailableError } from "./fleet-client";

// The calls of the Filom screens to the API (V2-36, openapi tag `fleet`). The session cookie travels with each one (api-request.ts); the
// API filters everything by the company of the account, so another company's record is a 404, which the screens show as a page that
// does not exist. Anything but an answer throws, and the page shows its error state with a way to try again.
async function read<T>(path: string): Promise<T> {
  const result = await apiRequest<T>("GET", path);
  if (result.status !== "ok") throw new ApiUnavailableError();
  return result.data;
}

// `null` when there is no such record (the page then does not exist), a failure to load otherwise.
async function readOrNull<T>(path: string): Promise<T | null> {
  const result = await apiRequest<T>("GET", path);
  if (result.status === "ok") return result.data;
  if (result.status === "not_found") return null;
  throw new ApiUnavailableError();
}

export const fetchFleetSummary = () => read<FleetSummary>("/fleet/summary");
export const fetchFleetVehicles = (query: URLSearchParams) => read<FleetVehiclePage>("/fleet/vehicles?" + query.toString());
export const fetchFleetVehicle = (plate: string) => readOrNull<FleetVehicleDetail>("/fleet/vehicles/" + encodeURIComponent(plate));
export const fetchFleetContracts = (query: URLSearchParams) => read<FleetContractPage>("/fleet/contracts?" + query.toString());
export const fetchFleetContract = (number: string) => readOrNull<FleetContractDetail>("/fleet/contracts/" + encodeURIComponent(number));
export const fetchFleetEmployees = (query: URLSearchParams) => read<FleetEmployeePage>("/fleet/employees?" + query.toString());
export const fetchFleetEmployee = (id: string) => readOrNull<FleetEmployee>("/fleet/employees/" + encodeURIComponent(id));
export const fetchFleetInvoices = (query: URLSearchParams) => read<InvoicePage>("/fleet/invoices?" + query.toString());
export const fetchFleetInvoice = (number: string) => readOrNull<Invoice>("/fleet/invoices/" + encodeURIComponent(number));
export const fetchFleetExpenses = (query: URLSearchParams) => read<FleetExpensePage>("/fleet/expenses?" + query.toString());
export const fetchFleetReport = (from: string, to: string) => read<FleetReport>("/fleet/reports?" + new URLSearchParams({ from, to }).toString());
export const fetchFleetGreen = (from: string, to: string) => read<GreenReport>("/fleet/green?" + new URLSearchParams({ from, to }).toString());
export const fetchFleetStations = (plate: string, limit: number) => readOrNull<StationList>("/fleet/vehicles/" + encodeURIComponent(plate) + "/charging-stations?limit=" + limit);
export const fetchFleetTracking = () => read<TrackingList>("/fleet/tracking");
export const fetchFleetRoute = (plate: string, date: string) => readOrNull<RouteDay>("/fleet/vehicles/" + encodeURIComponent(plate) + "/route?" + new URLSearchParams({ date }).toString());
export const fetchFleetRequests = (query: URLSearchParams) => read<ServiceRequestPage>("/fleet/requests?" + query.toString());
export const fetchFleetRequest = (number: string) => readOrNull<ServiceRequestDetail>("/fleet/requests/" + encodeURIComponent(number));
export const fetchFleetAssignments = (query: URLSearchParams) => read<FleetAssignmentPage>("/fleet/assignments?" + query.toString());
