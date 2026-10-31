import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import { isDay } from "./admin-contracts";
import type { components } from "./api-types";
import type { StatusTone } from "@/components/admin/status-chip";

// The service request screens (V2-41, docs/FLEET.md §3, docs/ADMIN.md §3.19, SPEC §3.D): what a request looks like, the steps of each kind
// (the same table as the API's, apps/api/src/fleet/requests/request-flow.ts), the lists' addresses, the form of the customer and what the
// writes answer. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type ServiceRequest = Schemas["ServiceRequest"];
export type ServiceRequestDetail = Schemas["ServiceRequestDetail"];
export type ServiceRequestPage = Schemas["ServiceRequestPage"];
export type ServiceRequestCreated = Schemas["ServiceRequestCreated"];
export type RequestType = Schemas["ServiceRequestType"];
export type RequestStatus = Schemas["ServiceRequestStatus"];
export type RequestEvent = Schemas["ServiceRequestEvent"];

// The kinds a customer can open today; a transfer is V2-42's.
export const CUSTOMER_TYPES = ["ROADSIDE", "REPLACEMENT_VEHICLE", "MAINTENANCE"] as const satisfies readonly RequestType[];
export const REQUEST_TYPES = ["ROADSIDE", "REPLACEMENT_VEHICLE", "MAINTENANCE", "TRANSFER"] as const satisfies readonly RequestType[];
export const REQUEST_STATUSES = ["RECEIVED", "DISPATCHED", "EN_ROUTE", "APPROVED", "DELIVERED", "RETURNED", "SCHEDULED", "IN_SERVICE", "DRIVER_ASSIGNED", "MET", "COMPLETED", "CANCELLED"] as const satisfies readonly RequestStatus[];

export const REQUEST_FLOWS: Record<RequestType, readonly RequestStatus[]> = {
  ROADSIDE: ["RECEIVED", "DISPATCHED", "EN_ROUTE", "COMPLETED"],
  REPLACEMENT_VEHICLE: ["RECEIVED", "APPROVED", "DELIVERED", "RETURNED"],
  MAINTENANCE: ["RECEIVED", "SCHEDULED", "IN_SERVICE", "COMPLETED"],
  TRANSFER: ["RECEIVED", "DRIVER_ASSIGNED", "MET", "COMPLETED"],
};

export function isFinished(type: RequestType, status: RequestStatus): boolean {
  const flow = REQUEST_FLOWS[type];
  return status === "CANCELLED" || status === flow[flow.length - 1];
}
export const isOpen = (type: RequestType, status: RequestStatus): boolean => !isFinished(type, status);

// Where Novera can move a request from where it is: any later step of its kind, or cancelled; nothing from a finished request.
export function nextStatuses(type: RequestType, status: RequestStatus): RequestStatus[] {
  if (isFinished(type, status)) return [];
  const flow = REQUEST_FLOWS[type];
  const at = flow.indexOf(status);
  return at < 0 ? [] : [...flow.slice(at + 1), "CANCELLED"];
}
export const canCustomerCancel = (status: RequestStatus): boolean => status === "RECEIVED";

// The state is shown with a word as well as a colour: a finished request is quiet, a cancelled one is not good news, an open one is in hand.
export const requestTone = (type: RequestType, status: RequestStatus): StatusTone => (status === "CANCELLED" ? "error" : isFinished(type, status) ? "success" : status === "RECEIVED" ? "warning" : "neutral");

// ---------- The lists' addresses ----------
// The addresses stay in Turkish (`durum`, `tur`); `durum=acik` is "not over yet" (`open=true` for the API), any other value is a step.
export const OPEN_FILTER = "acik";
export type RequestFilter = "durum" | "tur";
export const REQUEST_LIST = {
  sortable: ["createdAt", "updatedAt"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { durum: [OPEN_FILTER, ...REQUEST_STATUSES], tur: REQUEST_TYPES },
} satisfies AdminListConfig<RequestFilter>;

// The API's own names for what an address says.
export function requestApiFilters(filters: Partial<Record<RequestFilter, string>>): { status?: RequestStatus; open?: boolean; type?: RequestType } {
  return {
    ...(filters.durum === OPEN_FILTER ? { open: true } : filters.durum ? { status: filters.durum as RequestStatus } : {}),
    ...(filters.tur ? { type: filters.tur as RequestType } : {}),
  };
}

// ---------- The customer's form ----------
export const INCIDENTS = ["BREAKDOWN", "ACCIDENT", "TIRE", "FUEL_OR_CHARGE"] as const;
export const MAINTENANCE_SERVICES = ["PERIODIC", "SUMMER_TIRES", "WINTER_TIRES", "INSPECTION"] as const;

// One flat set of fields for every kind: the screen shows the ones of the chosen kind. Numbers and the position travel as text.
export type RequestFormValues = {
  type: string;
  fleetVehicleId: string;
  // Roadside
  incident: string;
  address: string;
  latitude: string;
  longitude: string;
  description: string;
  // Replacement vehicle
  date: string;
  durationDays: string;
  // Maintenance
  service: string;
  preferredDate: string;
  valet: boolean;
};
export const EMPTY_REQUEST_FORM: RequestFormValues = {
  type: "",
  fleetVehicleId: "",
  incident: "",
  address: "",
  latitude: "",
  longitude: "",
  description: "",
  date: "",
  durationDays: "",
  service: "",
  preferredDate: "",
  valet: false,
};

export type RequestFormMessages = Record<"type" | "fleetVehicleId" | "incident" | "location" | "address" | "description" | "date" | "durationDays" | "service" | "preferredDate", string>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ADDRESS = 200;
const MAX_DESCRIPTION = 500;
const MAX_RENTAL_DAYS = 90;

// A day from today to a year ahead, as the date field writes it. `today` is the Istanbul day, given by the caller (it has the clock).
export function isDayInRange(value: string, today: string): boolean {
  if (!isDay(value)) return false;
  const at = Date.parse(`${value}T00:00:00Z`);
  const first = Date.parse(`${today}T00:00:00Z`);
  return at >= first && at <= first + 366 * 86_400_000;
}

// The same rules the API applies (apps/api/src/fleet/requests/request-details.ts), checked here for comfort and again by the server action
// and the API (ADR-26). Only the fields of the chosen kind are looked at.
export function requestFormErrors(values: RequestFormValues, today: string): Partial<Record<keyof RequestFormValues | "location", true>> {
  const bad: Partial<Record<keyof RequestFormValues | "location", true>> = {};
  if (!(CUSTOMER_TYPES as readonly string[]).includes(values.type)) bad.type = true;
  if (!uuid.test(values.fleetVehicleId)) bad.fleetVehicleId = true;
  const address = values.address.trim();
  if (address.length > MAX_ADDRESS) bad.address = true;
  if (values.type === "ROADSIDE") {
    if (!(INCIDENTS as readonly string[]).includes(values.incident)) bad.incident = true;
    if (values.description.trim().length > MAX_DESCRIPTION) bad.description = true;
    const lat = values.latitude.trim() === "" ? null : Number(values.latitude);
    const lon = values.longitude.trim() === "" ? null : Number(values.longitude);
    const coordinateBad = (value: number | null, limit: number) => value !== null && (!Number.isFinite(value) || Math.abs(value) > limit);
    if (coordinateBad(lat, 90) || coordinateBad(lon, 180) || (lat === null) !== (lon === null)) bad.location = true;
    else if (address === "" && lat === null) bad.location = true;
  }
  if (values.type === "REPLACEMENT_VEHICLE") {
    if (address === "") bad.address = true;
    if (!isDayInRange(values.date, today)) bad.date = true;
    const days = Number(values.durationDays);
    if (values.durationDays.trim() === "" || !Number.isInteger(days) || days < 1 || days > MAX_RENTAL_DAYS) bad.durationDays = true;
  }
  if (values.type === "MAINTENANCE") {
    if (!(MAINTENANCE_SERVICES as readonly string[]).includes(values.service)) bad.service = true;
    if (!isDayInRange(values.preferredDate, today)) bad.preferredDate = true;
    if (values.valet && address === "") bad.address = true;
  }
  return bad;
}

// The schema the form uses: it reads `today` from the caller, and puts a failing field's message under its own name.
export const requestFormSchema = (m: RequestFormMessages, today: string) =>
  z.custom<RequestFormValues>().superRefine((values, context) => {
    const bad = requestFormErrors(values, today);
    for (const key of Object.keys(bad) as Array<keyof typeof bad>) {
      const message = m[key as keyof RequestFormMessages] ?? key;
      // The position problem belongs to the address field on screen.
      context.addIssue({ code: "custom", message, path: [key === "location" ? "address" : key] });
    }
  });

type CreateBody = Schemas["ServiceRequestCreate"];
const text = (value: string): string | null => value.trim() || null;

export function toRequestBody(values: RequestFormValues): CreateBody {
  const base = { type: values.type as RequestType, fleetVehicleId: values.fleetVehicleId };
  if (values.type === "ROADSIDE") {
    const location: { address?: string; latitude?: number; longitude?: number } = {};
    if (text(values.address)) location.address = values.address.trim();
    if (values.latitude.trim() !== "") {
      location.latitude = Number(values.latitude);
      location.longitude = Number(values.longitude);
    }
    return { ...base, details: { incident: values.incident as (typeof INCIDENTS)[number], location, ...(text(values.description) ? { description: values.description.trim() } : {}) } };
  }
  if (values.type === "REPLACEMENT_VEHICLE") return { ...base, details: { address: values.address.trim(), date: values.date, durationDays: Number(values.durationDays) } };
  return { ...base, details: { service: values.service as (typeof MAINTENANCE_SERVICES)[number], preferredDate: values.preferredDate, valet: values.valet, ...(text(values.address) ? { address: values.address.trim() } : {}) } };
}

// ---------- What the writes answer ----------
export type RequestCreateResult =
  | { status: "ok"; number: string; similarOpen: string[] }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "rate_limited"; retryAfter: number | null }
  | { status: "unavailable" };

export type RequestCancelResult =
  | { status: "ok" }
  | { status: "not_allowed" | "not_found" | "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

export type RequestMoveResult =
  | { status: "ok" }
  | { status: "not_allowed" | "not_found" | "unavailable" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "rate_limited"; retryAfter: number | null };

// The words a position from the phone ends up as: two numbers, shown to a few decimals.
export const roundCoordinate = (value: number): string => value.toFixed(5);
