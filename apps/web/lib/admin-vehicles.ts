import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The vehicle screens (V2-30, docs/ADMIN.md §3.1): what a car looks like to the administrator, the list's address, and the form
// that writes one. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminVehicle = Schemas["AdminVehicle"];
export type AdminVehicleDetail = Schemas["AdminVehicleDetail"];
export type AdminVehiclePage = Schemas["AdminVehiclePage"];
export type VehicleUsage = { reservations: number; holds: number };
// What the forms choose between: the models that are on the site, and the branches that are open.
export type ModelOption = { slug: string; label: string };
export type BranchOption = { id: string; label: string };

export const VEHICLE_STATUSES = ["ACTIVE", "INACTIVE"] as const;

// The list: what it can be sorted by (the API's names), the default order, and the three filters (`model`, `bayi`, `durum` in the
// address; `model`, `branch`, `status` for the API). The model and the branch are free text here (up to 100 characters, as the
// address helper reads it): the API knows which exist and finds nothing for one that does not.
export const VEHICLE_LIST = {
  sortable: ["plate", "year", "model", "branch", "createdAt"],
  defaultSort: { key: "plate", dir: "asc" },
  filters: { model: null, bayi: null, durum: VEHICLE_STATUSES },
} satisfies AdminListConfig<"model" | "bayi" | "durum">;
export const VEHICLE_API_FILTERS = { model: "model", bayi: "branch", durum: "status" } as const;

// ---------- The plate ----------
// The same rule as the API's (and the database's): a Turkish plate is the province code (01 to 81), one to three letters (no Q, W,
// X) and two to four digits. It is typed any way ("34abc123", "34-abc-123") and sent in the one form, "34 ABC 123".
const PLATE = /^(0[1-9]|[1-7]\d|8[01])([ABCDEFGHIJKLMNOPRSTUVYZ]{1,3})(\d{2,4})$/;

export function normalizePlate(raw: string): string | null {
  const match = PLATE.exec(raw.replace(/[\s.\-_]/g, "").toUpperCase());
  return match ? `${match[1]} ${match[2]} ${match[3]}` : null;
}

// ---------- The year ----------
export const MIN_YEAR = 2015;
// From 2015 to next year: a car of the coming model year can be bought in the autumn.
export const maxYear = (now: Date = new Date()): number => now.getFullYear() + 1;

// ---------- The form ----------
export type VehicleFormValues = {
  plate: string;
  year: string;
  modelSlug: string;
  branchId: string;
};

export const EMPTY_VEHICLE_FORM: VehicleFormValues = { plate: "", year: String(new Date().getFullYear()), modelSlug: "", branchId: "" };

export type VehicleFormMessages = {
  plate: string;
  year: string;
  modelSlug: string;
  branchId: string;
};

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The action reads only the names of
// the fields that failed; the form shows the words from the visitor's language. `now` is a parameter so a test can pick the year.
export const vehicleFormSchema = (m: VehicleFormMessages, now: Date = new Date()) =>
  z.object({
    plate: z.string().refine((value) => normalizePlate(value) !== null, m.plate),
    year: z.string().refine((value) => /^\d{4}$/.test(value.trim()) && Number(value) >= MIN_YEAR && Number(value) <= maxYear(now), m.year),
    modelSlug: z.string().trim().min(1, m.modelSlug),
    branchId: z.string().trim().min(1, m.branchId),
  });

// ---------- The API's bodies ----------
type CreateBody = Schemas["AdminVehicleCreate"];
type UpdateBody = Schemas["AdminVehicleUpdate"];

export function toCreateBody(values: VehicleFormValues): CreateBody {
  return {
    plate: normalizePlate(values.plate) ?? values.plate.trim(),
    year: Number(values.year),
    modelSlug: values.modelSlug,
    branchId: values.branchId,
  };
}

// Only what changed, and the version it was made against: a car can be moved, and that is all the form changes (the plate, the
// year and the model never do; switching on and off is its own action).
export function toMoveBody(branchId: string, updatedAt: string): UpdateBody {
  return { updatedAt, branchId };
}

export function formValuesOf(row: AdminVehicle): VehicleFormValues {
  return { plate: row.plate, year: String(row.year), modelSlug: row.model.slug, branchId: row.branch.id };
}

// ---------- What a save answers ----------
// `fields` maps a form field to the API's code for it. `usage` is what keeps a car where it is (the reasons a move or a switching
// off is refused).
export type VehicleSaveResult =
  | { status: "ok"; id: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "taken" }
  | { status: "stale" }
  | { status: "in_use"; usage: VehicleUsage }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
