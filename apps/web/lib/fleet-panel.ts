import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The Filom screens (V2-36, docs/FLEET.md §3): what the fleet looks like to the customer, the lists' addresses, and the forms that write
// the people and the assignments. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type FleetSummary = Schemas["FleetSummary"];
export type FleetVehicle = Schemas["FleetVehicle"];
export type FleetVehicleDetail = Schemas["FleetVehicleDetail"];
export type FleetVehiclePage = Schemas["FleetVehiclePage"];
export type FleetContract = Schemas["FleetContract"];
export type FleetContractDetail = Schemas["FleetContractDetail"];
export type FleetContractPage = Schemas["FleetContractPage"];
export type FleetEmployee = Schemas["FleetEmployee"];
export type FleetEmployeePage = Schemas["FleetEmployeePage"];
export type FleetAssignment = Schemas["FleetAssignment"];
export type FleetAssignmentPage = Schemas["FleetAssignmentPage"];

// ---------- The lists' addresses ----------
// The addresses stay in Turkish (`durum`, `zimmet`), the API's own names are English (`status`, `assigned`). A value that is not one of
// the allowed ones falls back to the default, so a made-up address shows the list instead of an error (lib/admin-query.ts).
export const VEHICLE_STATUS_FILTERS = ["kullanimda", "iade"] as const;
export const VEHICLE_ASSIGN_FILTERS = ["zimmetli", "bosta"] as const;
export type VehicleFilter = "durum" | "zimmet";
export const VEHICLE_LIST = {
  sortable: ["plate", "year", "createdAt"],
  defaultSort: { key: "plate", dir: "asc" },
  filters: { durum: VEHICLE_STATUS_FILTERS, zimmet: VEHICLE_ASSIGN_FILTERS },
} satisfies AdminListConfig<VehicleFilter>;

export const EMPLOYEE_STATE_FILTERS = ["aktif", "pasif"] as const;
export type EmployeeFilter = "durum";
export const EMPLOYEE_LIST = {
  sortable: ["lastName", "createdAt"],
  defaultSort: { key: "lastName", dir: "asc" },
  filters: { durum: EMPLOYEE_STATE_FILTERS },
} satisfies AdminListConfig<EmployeeFilter>;

export const ASSIGNMENT_STATE_FILTERS = ["acik", "kapali"] as const;
export type AssignmentFilter = "durum";
export const ASSIGNMENT_LIST = {
  sortable: [],
  defaultSort: undefined,
  filters: { durum: ASSIGNMENT_STATE_FILTERS },
} satisfies AdminListConfig<AssignmentFilter>;

export const CONTRACT_STATE_FILTERS = ["ACTIVE", "ENDED"] as const;
export type ContractFilter = "durum";
export const CONTRACT_LIST = {
  sortable: ["endAt", "startAt", "number"],
  defaultSort: { key: "endAt", dir: "asc" },
  filters: { durum: CONTRACT_STATE_FILTERS },
} satisfies AdminListConfig<ContractFilter>;

// What the API calls the filters, and the value it takes for ours.
export const VEHICLE_API_VALUES = {
  durum: { name: "status", values: { kullanimda: "ACTIVE", iade: "RETURNED" } },
  zimmet: { name: "assigned", values: { zimmetli: "true", bosta: "false" } },
} as const;
export const EMPLOYEE_API_VALUES = { durum: { name: "active", values: { aktif: "true", pasif: "false" } } } as const;
export const ASSIGNMENT_API_VALUES = { durum: { name: "open", values: { acik: "true", kapali: "false" } } } as const;

// ---------- The person form ----------
export type EmployeeFormValues = { firstName: string; lastName: string; department: string; employeeNo: string; email: string; phone: string };
export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = { firstName: "", lastName: "", department: "", employeeNo: "", email: "", phone: "" };

export type EmployeeFormMessages = { firstName: string; lastName: string; department: string; employeeNo: string; email: string; phone: string };

const phoneLike = (value: string): boolean => value.trim() === "" || (/^[0-9+()\-.\s]+$/.test(value.trim()) && value.replace(/\D/g, "").length >= 7);

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The name is required; the rest may be empty.
export const employeeFormSchema = (m: EmployeeFormMessages) =>
  z.object({
    firstName: z.string().trim().min(1, m.firstName).max(60, m.firstName),
    lastName: z.string().trim().min(1, m.lastName).max(60, m.lastName),
    department: z.string().trim().max(60, m.department),
    employeeNo: z.string().trim().max(30, m.employeeNo),
    email: z
      .string()
      .trim()
      .max(120, m.email)
      .refine((value) => value === "" || z.email().safeParse(value).success, m.email),
    phone: z.string().max(30, m.phone).refine(phoneLike, m.phone),
  });

type CreateBody = Schemas["FleetEmployeeCreate"];
type UpdateBody = Schemas["FleetEmployeeUpdate"];

export function toEmployeeCreateBody(values: EmployeeFormValues): CreateBody {
  const body: CreateBody = { firstName: values.firstName.trim(), lastName: values.lastName.trim() };
  if (values.department.trim()) body.department = values.department.trim();
  if (values.employeeNo.trim()) body.employeeNo = values.employeeNo.trim();
  if (values.email.trim()) body.email = values.email.trim();
  if (values.phone.trim()) body.phone = values.phone.trim();
  return body;
}

// Only what changed, and the version it was made against. An optional field emptied is sent as nothing (`null`), which clears it.
export function toEmployeeUpdateBody(values: EmployeeFormValues, initial: EmployeeFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.firstName.trim() !== initial.firstName.trim()) body.firstName = values.firstName.trim();
  if (values.lastName.trim() !== initial.lastName.trim()) body.lastName = values.lastName.trim();
  if (values.department.trim() !== initial.department.trim()) body.department = values.department.trim() || null;
  if (values.employeeNo.trim() !== initial.employeeNo.trim()) body.employeeNo = values.employeeNo.trim() || null;
  if (values.email.trim() !== initial.email.trim()) body.email = values.email.trim() || null;
  if (values.phone.trim() !== initial.phone.trim()) body.phone = values.phone.trim() || null;
  return body;
}

export const employeeFormValuesOf = (row: FleetEmployee): EmployeeFormValues => ({
  firstName: row.firstName,
  lastName: row.lastName,
  department: row.department ?? "",
  employeeNo: row.employeeNo ?? "",
  email: row.email ?? "",
  phone: row.phone ?? "",
});

// ---------- The assignment form ----------
export type AssignFormValues = { employeeId: string; startedAt: string; note: string };
export const EMPTY_ASSIGN_FORM: AssignFormValues = { employeeId: "", startedAt: "", note: "" };
export type AssignFormMessages = { employeeId: string; startedAt: string; note: string };

const isDay = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number) as [number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day && year >= 2000 && year <= 2100;
};

export const assignFormSchema = (m: AssignFormMessages) =>
  z.object({
    employeeId: z.string().min(1, m.employeeId).max(60, m.employeeId),
    startedAt: z.string().refine((value) => value.trim() === "" || isDay(value.trim()), m.startedAt),
    note: z.string().trim().max(200, m.note),
  });

export function toAssignBody(vehicleId: string, values: AssignFormValues): Schemas["FleetAssignmentCreate"] {
  const body: Schemas["FleetAssignmentCreate"] = { fleetVehicleId: vehicleId, employeeId: values.employeeId };
  if (values.startedAt.trim()) body.startedAt = values.startedAt.trim();
  if (values.note.trim()) body.note = values.note.trim();
  return body;
}

// ---------- What a write answers ----------
// `fields` maps a form field to the API's code for it. `assigned` is a car that has someone already; `no_taken` is a sicil no that another
// person of the company has.
export type EmployeeSaveResult =
  | { status: "ok"; id: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "no_taken" }
  | { status: "stale" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

export type AssignmentResult =
  | { status: "ok" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "assigned" }
  | { status: "not_allowed" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

// The days until a date, for the cards that say "in 12 days" (the maintenance and the inspection): negative once it has passed.
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
