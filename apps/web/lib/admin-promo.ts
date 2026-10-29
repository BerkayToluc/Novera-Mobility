import { z } from "zod";
import type { StatusTone } from "@/components/admin/status-chip";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";
import { normalizePromo } from "./promo-codes";

// The campaign code screens (V2-26, docs/ADMIN.md §3.1): what a code looks like, the list's address, and the form that
// writes one. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type PromoCode = Schemas["PromoCode"];
export type PromoCodePage = Schemas["PromoCodePage"];
export type PromoStatus = Schemas["PromoCodeStatus"];

export const PROMO_STATUSES = ["ACTIVE", "SCHEDULED", "INACTIVE", "EXPIRED", "EXHAUSTED"] as const satisfies readonly PromoStatus[];

// The list: what it can be sorted by (the API's names), the default order, and the one filter, `durum` in the address.
export const PROMO_LIST = {
  sortable: ["code", "percent", "used", "validUntil", "createdAt"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { durum: PROMO_STATUSES },
} satisfies AdminListConfig<"durum">;
export const PROMO_API_FILTERS = { durum: "status" } as const;

// A state is a word, never only a colour (DESIGN.md §8); the tone is the colour that goes with it.
export const PROMO_TONES: Record<PromoStatus, StatusTone> = {
  ACTIVE: "success",
  SCHEDULED: "warning",
  INACTIVE: "neutral",
  EXPIRED: "neutral",
  EXHAUSTED: "warning",
};

// ---------- Days ----------
// A code's period is chosen in whole days, in Istanbul time (Turkey has had no daylight saving since 2016, so a day
// starts at 00:00+03:00). The first day is included; the last day is included too, so the code ends at the start of the
// day after it. The API keeps exact instants, so a code made by another route with a time in it stays as it is: the form
// only sends a date again when the person changed it (`toUpdateBody`).
const DAY_MS = 86_400_000;
const startOf = (day: string): number => Date.parse(day + "T00:00:00+03:00");

export const dayStart = (day: string): string => new Date(startOf(day)).toISOString();
export const dayAfter = (day: string): string => new Date(startOf(day) + DAY_MS).toISOString();

export function istanbulDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

// The last day a code works: the end is not part of its period, so it is the day of the instant just before it.
export const lastDay = (endIso: string): string => istanbulDay(new Date(Date.parse(endIso) - 1).toISOString());

// ---------- The form ----------
export type PromoFormValues = {
  code: string;
  percent: string;
  active: boolean;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  oncePerUser: boolean;
};

export const EMPTY_PROMO_FORM: PromoFormValues = {
  code: "",
  percent: "",
  active: true,
  validFrom: "",
  validUntil: "",
  maxRedemptions: "",
  oncePerUser: true,
};

export type PromoFormMessages = { code: string; percent: string; validFrom: string; validUntil: string; maxRedemptions: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (value: string): boolean => DAY.test(value) && !Number.isNaN(startOf(value));

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The action reads only the
// names of the fields that failed; the form shows the words from the visitor's language.
export const promoFormSchema = (m: PromoFormMessages) =>
  z
    .object({
      code: z
        .string()
        .trim()
        .refine((value) => normalizePromo(value) !== undefined, m.code),
      percent: z
        .string()
        .trim()
        .refine((value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 90, m.percent),
      active: z.boolean(),
      validFrom: z.string().trim().refine((value) => value === "" || validDay(value), m.validFrom),
      validUntil: z.string().trim().refine((value) => value === "" || validDay(value), m.validUntil),
      maxRedemptions: z
        .string()
        .trim()
        .refine((value) => value === "" || (/^\d{1,7}$/.test(value) && Number(value) >= 1), m.maxRedemptions),
      oncePerUser: z.boolean(),
    })
    .refine((values) => !values.validFrom || !values.validUntil || values.validUntil >= values.validFrom, {
      path: ["validUntil"],
      message: m.validUntil,
    });

// ---------- The API's bodies ----------
type CreateBody = Schemas["PromoCodeCreate"];
type UpdateBody = Schemas["PromoCodeUpdate"];

export function toCreateBody(values: PromoFormValues): CreateBody {
  return {
    code: normalizePromo(values.code) ?? values.code,
    percent: Number(values.percent),
    active: values.active,
    validFrom: values.validFrom ? dayStart(values.validFrom) : null,
    validUntil: values.validUntil ? dayAfter(values.validUntil) : null,
    maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : null,
    oncePerUser: values.oncePerUser,
  };
}

// Only what changed, and the version it was made against. A date that was not touched is not sent, so an exact time that
// the form cannot show is not rounded to a day by a change to something else.
export function toUpdateBody(values: PromoFormValues, initial: PromoFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.percent !== initial.percent) body.percent = Number(values.percent);
  if (values.active !== initial.active) body.active = values.active;
  if (values.validFrom !== initial.validFrom) body.validFrom = values.validFrom ? dayStart(values.validFrom) : null;
  if (values.validUntil !== initial.validUntil) body.validUntil = values.validUntil ? dayAfter(values.validUntil) : null;
  if (values.maxRedemptions !== initial.maxRedemptions) body.maxRedemptions = values.maxRedemptions ? Number(values.maxRedemptions) : null;
  if (values.oncePerUser !== initial.oncePerUser) body.oncePerUser = values.oncePerUser;
  return body;
}

export function formValuesOf(row: PromoCode): PromoFormValues {
  return {
    code: row.code,
    percent: String(row.percent),
    active: row.active,
    validFrom: row.validFrom ? istanbulDay(row.validFrom) : "",
    validUntil: row.validUntil ? lastDay(row.validUntil) : "",
    maxRedemptions: row.maxRedemptions === null ? "" : String(row.maxRedemptions),
    oncePerUser: row.oncePerUser,
  };
}

// ---------- What a save answers ----------
// `fields` maps a form field to the API's code for it (`INVALID_DATE_RANGE`, `BELOW_USAGE` ...), so the form can say more
// than "wrong" for the ones that have their own words.
export type PromoSaveResult =
  | { status: "ok"; code: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "taken" }
  | { status: "stale" }
  | { status: "in_use" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
