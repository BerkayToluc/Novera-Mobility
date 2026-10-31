import { z } from "zod";
import { normalizePlate } from "./admin-vehicles";
import type { components } from "./api-types";
import { TURKISH_CITIES } from "./turkish-cities";

// The contract screens of the panel (V2-35, docs/ADMIN.md §3.12): what a contract and its cars look like to the administrator, and the
// forms that write them. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type FleetContract = Schemas["FleetContract"];
export type FleetContractDetail = Schemas["FleetContractDetail"];
export type FleetVehicle = Schemas["FleetVehicle"];
export type FleetReading = Schemas["FleetReading"];

// The products a fleet contract can be for (SPEC §2.1). The slugs are the API's.
export const CONTRACT_PRODUCTS = ["akilli-kurumsal-filo", "yesil-filo", "vip-mobilite", "esnek-kisa-donem"] as const;
export const CONTRACT_STATUSES = ["ACTIVE", "ENDED"] as const;

// ---------- Money ----------
// The fee is typed in lira and travels in kuruş (₺45.000 is 4500000), the way the prices of the cars are: one or two decimals, a comma
// or a dot, no thousands separator ("45000", "45000,50"). Up to 100 million lira a month, as the API.
const FEE = /^\d{1,8}([.,]\d{1,2})?$/;
export const MAX_FEE_KURUS = 10_000_000_000;

export function feeToKurus(text: string): number | null {
  const value = text.trim();
  if (!FEE.test(value)) return null;
  const kurus = Math.round(Number(value.replace(",", ".")) * 100);
  return kurus >= 1 && kurus <= MAX_FEE_KURUS ? kurus : null;
}

export function kurusToFee(kurus: number): string {
  const whole = Math.floor(kurus / 100);
  const rest = kurus % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}

// A day as the date field writes it, "2026-10-31", that is a real one.
export function isDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number) as [number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day && year >= 2000 && year <= 2100;
}

// ---------- The contract form ----------
export type ContractFormValues = {
  productSlug: string;
  startAt: string;
  endAt: string;
  // Lira, as typed.
  monthlyFee: string;
  deliveryCity: string;
  status: "ACTIVE" | "ENDED";
};

export const EMPTY_CONTRACT_FORM: ContractFormValues = { productSlug: "akilli-kurumsal-filo", startAt: "", endAt: "", monthlyFee: "", deliveryCity: "", status: "ACTIVE" };

export type ContractFormMessages = { productSlug: string; startAt: string; endAt: string; monthlyFee: string; deliveryCity: string };

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The end day is after the start day.
export const contractFormSchema = (m: ContractFormMessages) =>
  z
    .object({
      productSlug: z.string().refine((value) => (CONTRACT_PRODUCTS as readonly string[]).includes(value), m.productSlug),
      startAt: z.string().refine(isDay, m.startAt),
      endAt: z.string().refine(isDay, m.endAt),
      monthlyFee: z.string().refine((value) => feeToKurus(value) !== null, m.monthlyFee),
      deliveryCity: z.string().refine((value) => TURKISH_CITIES.includes(value), m.deliveryCity),
      status: z.enum(CONTRACT_STATUSES),
    })
    .superRefine((value, context) => {
      if (isDay(value.startAt) && isDay(value.endAt) && value.endAt <= value.startAt) context.addIssue({ code: "custom", path: ["endAt"], message: m.endAt });
    });

type CreateBody = Schemas["AdminContractCreate"];
type UpdateBody = Schemas["AdminContractUpdate"];

export const toCreateBody = (values: ContractFormValues): CreateBody => ({
  productSlug: values.productSlug,
  startAt: values.startAt,
  endAt: values.endAt,
  monthlyFee: feeToKurus(values.monthlyFee) ?? Number.NaN,
  deliveryCity: values.deliveryCity,
});

// Only what changed, and the version it was made against. The product and the start day do not change.
export function toUpdateBody(values: ContractFormValues, initial: ContractFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.endAt !== initial.endAt) body.endAt = values.endAt;
  if (feeToKurus(values.monthlyFee) !== feeToKurus(initial.monthlyFee)) body.monthlyFee = feeToKurus(values.monthlyFee) ?? Number.NaN;
  if (values.deliveryCity !== initial.deliveryCity) body.deliveryCity = values.deliveryCity;
  if (values.status !== initial.status) body.status = values.status;
  return body;
}

export const contractFormValuesOf = (row: FleetContract): ContractFormValues => ({
  productSlug: row.productSlug,
  startAt: row.startAt,
  endAt: row.endAt,
  monthlyFee: kurusToFee(row.monthlyFee),
  deliveryCity: row.deliveryCity,
  status: row.status,
});

// ---------- The car form ----------
export type VehicleFormValues = { modelSlug: string; plate: string; year: string; startKm: string; nextMaintenanceOn: string; inspectionDueOn: string };

export const MIN_YEAR = 2000;
export const MAX_KM = 2_000_000;
export const EMPTY_VEHICLE_FORM: VehicleFormValues = { modelSlug: "", plate: "", year: "", startKm: "", nextMaintenanceOn: "", inspectionDueOn: "" };

export type VehicleFormMessages = { modelSlug: string; plate: string; year: string; startKm: string; nextMaintenanceOn: string; inspectionDueOn: string };

const whole = (text: string): number | null => (/^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : null);
const optionalDay = (text: string): boolean => text.trim() === "" || isDay(text.trim());

export const vehicleFormSchema = (m: VehicleFormMessages, now: () => Date = () => new Date()) =>
  z.object({
    modelSlug: z.string().min(1, m.modelSlug).max(60, m.modelSlug),
    plate: z.string().refine((value) => normalizePlate(value) !== null, m.plate),
    year: z.string().refine((value) => {
      const year = whole(value);
      return year !== null && year >= MIN_YEAR && year <= now().getUTCFullYear() + 1;
    }, m.year),
    startKm: z.string().refine((value) => {
      const km = whole(value);
      return km !== null && km <= MAX_KM;
    }, m.startKm),
    nextMaintenanceOn: z.string().refine(optionalDay, m.nextMaintenanceOn),
    inspectionDueOn: z.string().refine(optionalDay, m.inspectionDueOn),
  });

export function toVehicleBody(values: VehicleFormValues): Schemas["AdminFleetVehicleCreate"] {
  const body: Schemas["AdminFleetVehicleCreate"] = {
    modelSlug: values.modelSlug,
    plate: normalizePlate(values.plate) ?? values.plate.trim(),
    year: whole(values.year) ?? Number.NaN,
    startKm: whole(values.startKm) ?? Number.NaN,
  };
  if (values.nextMaintenanceOn.trim()) body.nextMaintenanceOn = values.nextMaintenanceOn.trim();
  if (values.inspectionDueOn.trim()) body.inspectionDueOn = values.inspectionDueOn.trim();
  return body;
}

// ---------- The reading form ----------
export type ReadingFormValues = { km: string; fuelPercent: string; chargePercent: string; batteryHealthPercent: string };
export const EMPTY_READING_FORM: ReadingFormValues = { km: "", fuelPercent: "", chargePercent: "", batteryHealthPercent: "" };

export type ReadingFormMessages = { km: string; fuelPercent: string; chargePercent: string; batteryHealthPercent: string };

const optionalPercent = (text: string): boolean => {
  if (text.trim() === "") return true;
  const value = whole(text);
  return value !== null && value <= 100;
};

export const readingFormSchema = (m: ReadingFormMessages) =>
  z.object({
    km: z.string().refine((value) => {
      const km = whole(value);
      return km !== null && km <= MAX_KM;
    }, m.km),
    fuelPercent: z.string().refine(optionalPercent, m.fuelPercent),
    chargePercent: z.string().refine(optionalPercent, m.chargePercent),
    batteryHealthPercent: z.string().refine(optionalPercent, m.batteryHealthPercent),
  });

export function toReadingBody(values: ReadingFormValues): Schemas["AdminReadingCreate"] {
  const body: Schemas["AdminReadingCreate"] = { km: whole(values.km) ?? Number.NaN };
  if (values.fuelPercent.trim()) body.fuelPercent = whole(values.fuelPercent) ?? Number.NaN;
  if (values.chargePercent.trim()) body.chargePercent = whole(values.chargePercent) ?? Number.NaN;
  if (values.batteryHealthPercent.trim()) body.batteryHealthPercent = whole(values.batteryHealthPercent) ?? Number.NaN;
  return body;
}

// ---------- What a write answers ----------
// `fields` maps a form field to the API's code for it. `usage` is how many cars keep a contract from ending.
export type ContractSaveResult =
  | { status: "ok"; number: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "stale" }
  | { status: "in_use"; vehicles: number }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

// A car or a reading: `taken` is a plate that a car already has (rented or in a fleet); `not_allowed` is a car that was given back or a
// contract that has ended.
export type FleetWriteResult =
  | { status: "ok" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "taken" }
  | { status: "stale" }
  | { status: "not_allowed" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
