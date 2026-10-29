import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";
import { normalizeSearch } from "./branch-detail";

// The vehicle model screens (V2-29, docs/ADMIN.md §3.1): what a model looks like to the administrator, the list's address, and
// the form that writes one. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminModel = Schemas["AdminVehicleModel"];
export type AdminModelDetail = Schemas["AdminVehicleModelDetail"];
export type AdminModelPage = Schemas["AdminVehicleModelPage"];
export type ModelClass = { slug: string; name: { tr: string; en: string } };
export type ModelUsage = { reservations: number; holds: number };

export const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"] as const;
export const TRANSMISSIONS = ["MANUAL", "AUTOMATIC"] as const;
export const MODEL_STATUSES = ["ACTIVE", "RETIRED"] as const;
export type FuelValue = (typeof FUEL_TYPES)[number];

// The list: what it can be sorted by (the API's names), the default order, and the three filters (`sinif`, `yakit`, `durum` in
// the address; `class`, `fuel`, `status` for the API). The class is free text here (up to 100 characters, as the address helper
// reads it): the API knows which classes exist and finds nothing for one that does not.
export const MODEL_LIST = {
  sortable: ["name", "dailyPrice", "activeVehicles", "createdAt"],
  defaultSort: { key: "name", dir: "asc" },
  filters: { sinif: null, yakit: FUEL_TYPES, durum: MODEL_STATUSES },
} satisfies AdminListConfig<"sinif" | "yakit" | "durum">;
export const MODEL_API_FILTERS = { sinif: "class", yakit: "fuel", durum: "status" } as const;

export const isElectric = (fuel: string): boolean => fuel === "ELECTRIC";
// The unit follows the fuel (the API and the database keep the same rule): kWh for an electric car, litres for any other.
export const consumptionUnitOf = (fuel: string): "KWH_PER_100KM" | "L_PER_100KM" => (isElectric(fuel) ? "KWH_PER_100KM" : "L_PER_100KM");

// ---------- The address of a model ----------
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MIN_SLUG = 3;

// The address a model gets from its name: "Renault Clio" is `renault-clio`, "Çelik Şahin" `celik-sahin`. The same as the API's
// `slugOf`, so what the form suggests is what the API would make.
export function suggestSlug(brand: string, model: string): string {
  return normalizeSearch(`${brand} ${model}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- Money ----------
// The price is typed in lira and travels in kuruş (₺1.250 is 125000). One or two decimals, with a comma or a dot, and no
// thousands separator: "1250", "1250,5", "1250.50". "1.250" would be one lira twenty-five, or twelve hundred and fifty,
// depending on who is reading, so it is not accepted (three decimals do not fit) and the message says how to write it.
const PRICE = /^\d{1,6}([.,]\d{1,2})?$/;
export const MAX_PRICE_KURUS = 10_000_000;

export function liraToKurus(text: string): number | null {
  const value = text.trim();
  if (!PRICE.test(value)) return null;
  const kurus = Math.round(Number(value.replace(",", ".")) * 100);
  return kurus >= 1 && kurus <= MAX_PRICE_KURUS ? kurus : null;
}

// For the field: 125000 is "1250", 125050 is "1250,50".
export function kurusToLira(kurus: number): string {
  const whole = Math.floor(kurus / 100);
  const rest = kurus % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}

// A consumption is typed with a comma or a dot, one decimal at most is kept.
export function parseConsumption(text: string): number | null {
  const value = text.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const number = Number(value);
  return number > 0 && number <= 100 ? number : null;
}

// ---------- The form ----------
export type ModelFormValues = {
  brand: string;
  model: string;
  // Chosen once, when the model is made; empty means "make it from the name". Never sent with a change.
  slug: string;
  classSlug: string;
  fuelType: FuelValue;
  transmission: (typeof TRANSMISSIONS)[number];
  seats: string;
  bags: string;
  consumption: string;
  dailyPrice: string;
  descriptionTr: string;
  descriptionEn: string;
  // The address of the stored picture; empty means none.
  imageUrl: string;
};

export const EMPTY_MODEL_FORM: ModelFormValues = {
  brand: "",
  model: "",
  slug: "",
  classSlug: "",
  fuelType: "PETROL",
  transmission: "MANUAL",
  seats: "5",
  bags: "2",
  consumption: "",
  dailyPrice: "",
  descriptionTr: "",
  descriptionEn: "",
  imageUrl: "",
};

export type ModelFormMessages = {
  brand: string;
  model: string;
  slug: string;
  classSlug: string;
  seats: string;
  bags: string;
  consumption: string;
  dailyPrice: string;
  descriptionTr: string;
  descriptionEn: string;
};

const wholeIn = (text: string, min: number, max: number): boolean => /^\d{1,2}$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The action reads only the names of
// the fields that failed; the form shows the words from the visitor's language.
export const modelFormSchema = (m: ModelFormMessages) =>
  z.object({
    brand: z.string().trim().min(1, m.brand).max(40, m.brand),
    model: z.string().trim().min(1, m.model).max(60, m.model),
    slug: z.string().trim().refine((value) => value === "" || (value.length >= MIN_SLUG && value.length <= 60 && SLUG.test(value)), m.slug),
    classSlug: z.string().trim().min(1, m.classSlug),
    fuelType: z.enum(FUEL_TYPES),
    transmission: z.enum(TRANSMISSIONS),
    seats: z.string().refine((value) => wholeIn(value, 1, 9), m.seats),
    bags: z.string().refine((value) => wholeIn(value, 0, 10), m.bags),
    consumption: z.string().refine((value) => parseConsumption(value) !== null, m.consumption),
    dailyPrice: z.string().refine((value) => liraToKurus(value) !== null, m.dailyPrice),
    descriptionTr: z.string().trim().min(1, m.descriptionTr).max(1000, m.descriptionTr),
    descriptionEn: z.string().trim().min(1, m.descriptionEn).max(1000, m.descriptionEn),
    imageUrl: z.string().trim().max(500),
  });

// ---------- The API's bodies ----------
type CreateBody = Schemas["AdminVehicleModelCreate"];
type UpdateBody = Schemas["AdminVehicleModelUpdate"];

export function toCreateBody(values: ModelFormValues): CreateBody {
  return {
    brand: values.brand.trim(),
    model: values.model.trim(),
    ...(values.slug.trim() ? { slug: values.slug.trim() } : {}),
    classSlug: values.classSlug,
    fuelType: values.fuelType,
    transmission: values.transmission,
    seats: Number(values.seats),
    bags: Number(values.bags),
    consumption: parseConsumption(values.consumption) ?? Number.NaN,
    dailyPrice: liraToKurus(values.dailyPrice) ?? Number.NaN,
    description: { tr: values.descriptionTr.trim(), en: values.descriptionEn.trim() },
    imageUrl: values.imageUrl.trim() || null,
  };
}

// Only what changed, and the version it was made against. The address is never sent (it does not change). The consumption is
// sent whenever the fuel moves between an electric and another car, because the unit changes with it and the API wants it again.
export function toUpdateBody(values: ModelFormValues, initial: ModelFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.brand.trim() !== initial.brand.trim()) body.brand = values.brand.trim();
  if (values.model.trim() !== initial.model.trim()) body.model = values.model.trim();
  if (values.classSlug !== initial.classSlug) body.classSlug = values.classSlug;
  if (values.fuelType !== initial.fuelType) body.fuelType = values.fuelType;
  if (values.transmission !== initial.transmission) body.transmission = values.transmission;
  if (values.seats.trim() !== initial.seats.trim()) body.seats = Number(values.seats);
  if (values.bags.trim() !== initial.bags.trim()) body.bags = Number(values.bags);
  const crosses = isElectric(values.fuelType) !== isElectric(initial.fuelType);
  if (crosses || parseConsumption(values.consumption) !== parseConsumption(initial.consumption)) {
    body.consumption = parseConsumption(values.consumption) ?? Number.NaN;
  }
  if (liraToKurus(values.dailyPrice) !== liraToKurus(initial.dailyPrice)) body.dailyPrice = liraToKurus(values.dailyPrice) ?? Number.NaN;
  if (values.descriptionTr.trim() !== initial.descriptionTr.trim() || values.descriptionEn.trim() !== initial.descriptionEn.trim()) {
    body.description = { tr: values.descriptionTr.trim(), en: values.descriptionEn.trim() };
  }
  if (values.imageUrl.trim() !== initial.imageUrl.trim()) body.imageUrl = values.imageUrl.trim() || null;
  return body;
}

export function formValuesOf(row: AdminModel): ModelFormValues {
  return {
    brand: row.brand,
    model: row.model,
    slug: row.slug,
    classSlug: row.class.slug,
    fuelType: row.fuelType,
    transmission: row.transmission,
    seats: String(row.seats),
    bags: String(row.bags),
    consumption: String(row.consumption.value).replace(".", ","),
    dailyPrice: kurusToLira(row.dailyPrice),
    descriptionTr: row.description.tr,
    descriptionEn: row.description.en,
    imageUrl: row.imageUrl ?? "",
  };
}

// ---------- What a save answers ----------
// `fields` maps a form field to the API's code for it. `usage` is what keeps a model on the site (the reasons a retiring is refused).
export type ModelSaveResult =
  | { status: "ok"; slug: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "taken" }
  | { status: "stale" }
  | { status: "in_use"; usage: ModelUsage }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
