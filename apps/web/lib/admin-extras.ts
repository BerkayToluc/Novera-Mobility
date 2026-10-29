import { z } from "zod";
import type { components } from "./api-types";
import { kurusToLira } from "./admin-models";

// The extra service screens (V2-30, docs/ADMIN.md §3.1): what an extra looks like to the administrator and the form that changes
// its name and price. Extras are fixed: none is added or removed here. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminExtra = Schemas["AdminExtra"];

// An extra costs from nothing to ₺10.000, in kuruş (the API's bound, a typo guard).
export const MAX_EXTRA_KURUS = 1_000_000;
// One or two decimals, a comma or a dot, no thousands separator ("150", "150,5", "150.50"); the same shape as a model's price.
const PRICE = /^\d{1,5}([.,]\d{1,2})?$/;

export function extraLiraToKurus(text: string): number | null {
  const value = text.trim();
  if (!PRICE.test(value)) return null;
  const kurus = Math.round(Number(value.replace(",", ".")) * 100);
  return kurus >= 0 && kurus <= MAX_EXTRA_KURUS ? kurus : null;
}

export type ExtraFormValues = { nameTr: string; nameEn: string; price: string };

export type ExtraFormMessages = { nameTr: string; nameEn: string; price: string };

// The same schema the form and the server action use (ADR-26).
export const extraFormSchema = (m: ExtraFormMessages) =>
  z.object({
    nameTr: z.string().trim().min(1, m.nameTr).max(80, m.nameTr),
    nameEn: z.string().trim().min(1, m.nameEn).max(80, m.nameEn),
    price: z.string().refine((value) => extraLiraToKurus(value) !== null, m.price),
  });

export const formValuesOf = (row: AdminExtra): ExtraFormValues => ({ nameTr: row.name.tr, nameEn: row.name.en, price: kurusToLira(row.price) });

type UpdateBody = Schemas["AdminExtraUpdate"];

// Only what changed, and the version it was made against.
export function toUpdateBody(values: ExtraFormValues, initial: ExtraFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.nameTr.trim() !== initial.nameTr.trim() || values.nameEn.trim() !== initial.nameEn.trim()) {
    body.name = { tr: values.nameTr.trim(), en: values.nameEn.trim() };
  }
  if (extraLiraToKurus(values.price) !== extraLiraToKurus(initial.price)) body.price = extraLiraToKurus(values.price) ?? Number.NaN;
  return body;
}

export type ExtraSaveResult =
  | { status: "ok"; slug: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "stale" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
