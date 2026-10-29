import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";
import { TURKISH_CITIES } from "./turkish-cities";

// The branch screens (V2-27, docs/ADMIN.md §3.1): what a branch looks like to the administrator, the list's address, and
// the form that writes one. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminBranch = Schemas["AdminBranch"];
export type AdminBranchDetail = Schemas["AdminBranchDetail"];
export type AdminBranchPage = Schemas["AdminBranchPage"];
export type BranchUsage = Schemas["BranchUsage"];
export type BranchKindValue = Schemas["BranchKind"];

export const BRANCH_STATUSES = ["OPEN", "CLOSED"] as const;

// The list: what it can be sorted by (the API's names), the default order, and the two filters, `sehir` and `durum` in the
// address (`city` and `status` for the API).
export const BRANCH_LIST = {
  sortable: ["name", "city", "activeVehicles", "createdAt"],
  defaultSort: { key: "name", dir: "asc" },
  filters: { sehir: TURKISH_CITIES, durum: BRANCH_STATUSES },
} satisfies AdminListConfig<"sehir" | "durum">;
export const BRANCH_API_FILTERS = { sehir: "city", durum: "status" } as const;

// ---------- Opening hours ----------
// A day is `HH:MM-HH:MM` or `closed`, the way the API stores it. The form holds each day as a switch and two times.
export type DayForm = { closed: boolean; open: string; close: string };
export type DayName = "weekdays" | "saturday" | "sunday";
export const DAYS: readonly DayName[] = ["weekdays", "saturday", "sunday"];

// What a day starts as when it is switched from closed to open, and what a new branch starts with.
export const DEFAULT_DAY: DayForm = { closed: false, open: "08:30", close: "19:00" };

const OPEN = /^([01]\d|2[0-3]):[0-5]\d$/;
// "24:00" is how the sample data (and the branch cards) write "until midnight"; the API takes up to 23:59. It is accepted
// for the closing time only, so a sample branch that is open all day can be edited; sending it to the API is refused there.
const CLOSE = /^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export const dayIsValid = (day: DayForm): boolean => day.closed || (OPEN.test(day.open) && CLOSE.test(day.close) && day.open < day.close);

export const dayToApi = (day: DayForm): string => (day.closed ? "closed" : `${day.open}-${day.close}`);

export function dayFromApi(value: string): DayForm {
  const [open, close] = value.split("-");
  if (value === "closed" || !open || !close) return { ...DEFAULT_DAY, closed: true };
  return { closed: false, open, close };
}

// ---------- The form ----------
export type BranchFormValues = {
  name: string;
  city: string;
  address: string;
  // Text, because a person types them (and may write the Turkish decimal comma).
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  kind: BranchKindValue;
  weekdays: DayForm;
  saturday: DayForm;
  sunday: DayForm;
};

export const EMPTY_BRANCH_FORM: BranchFormValues = {
  name: "",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  phone: "",
  email: "",
  kind: "CITY",
  weekdays: DEFAULT_DAY,
  saturday: { closed: false, open: "09:00", close: "17:00" },
  sunday: { closed: true, open: "10:00", close: "16:00" },
};

// The same box as the API's (`LATITUDE`, `LONGITUDE` in the API's branches.schemas.ts): a little wider than Türkiye.
export const LATITUDE_RANGE = { min: 35.5, max: 42.5 } as const;
export const LONGITUDE_RANGE = { min: 25.5, max: 45.0 } as const;

// "39,9179" and "39.9179" are the same number.
export function parseCoordinate(text: string): number | null {
  const value = text.trim().replace(",", ".");
  if (!/^-?\d{1,3}(\.\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const inRange = (text: string, range: { min: number; max: number }): boolean => {
  const value = parseCoordinate(text);
  return value !== null && value >= range.min && value <= range.max;
};

export type BranchFormMessages = {
  name: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  hours: string;
};

const dayShape = z.object({ closed: z.boolean(), open: z.string(), close: z.string() });

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). The action reads only the
// names of the fields that failed; the form shows the words from the visitor's language. `hours` is reported on the day.
export const branchFormSchema = (m: BranchFormMessages) =>
  z.object({
    name: z.string().trim().min(2, m.name).max(80, m.name),
    city: z.string().refine((value) => TURKISH_CITIES.includes(value), m.city),
    address: z.string().trim().min(5, m.address).max(200, m.address),
    latitude: z.string().refine((value) => inRange(value, LATITUDE_RANGE), m.latitude),
    longitude: z.string().refine((value) => inRange(value, LONGITUDE_RANGE), m.longitude),
    phone: z
      .string()
      .trim()
      .max(30, m.phone)
      .refine((value) => /^[0-9+()\-.\s]+$/.test(value) && value.replace(/\D/g, "").length >= 7, m.phone),
    email: z.email(m.email).max(120, m.email),
    kind: z.enum(["CITY", "AIRPORT"]),
    weekdays: dayShape.refine(dayIsValid, m.hours),
    saturday: dayShape.refine(dayIsValid, m.hours),
    sunday: dayShape.refine(dayIsValid, m.hours),
  });

// ---------- The API's bodies ----------
type CreateBody = Schemas["AdminBranchCreate"];
type UpdateBody = Schemas["AdminBranchUpdate"];

const hoursOf = (values: BranchFormValues) => ({
  weekdays: dayToApi(values.weekdays),
  saturday: dayToApi(values.saturday),
  sunday: dayToApi(values.sunday),
});

export function toCreateBody(values: BranchFormValues): CreateBody {
  return {
    name: values.name.trim(),
    city: values.city,
    address: values.address.trim(),
    latitude: parseCoordinate(values.latitude) ?? Number.NaN,
    longitude: parseCoordinate(values.longitude) ?? Number.NaN,
    phone: values.phone.trim(),
    email: values.email.trim(),
    kind: values.kind,
    openingHours: hoursOf(values),
  };
}

const sameDay = (a: DayForm, b: DayForm): boolean => dayToApi(a) === dayToApi(b);

// Only what changed, and the version it was made against. The three days go together (the API takes the whole of them).
export function toUpdateBody(values: BranchFormValues, initial: BranchFormValues, updatedAt: string): UpdateBody {
  const body: UpdateBody = { updatedAt };
  if (values.name.trim() !== initial.name.trim()) body.name = values.name.trim();
  if (values.city !== initial.city) body.city = values.city;
  if (values.address.trim() !== initial.address.trim()) body.address = values.address.trim();
  if (parseCoordinate(values.latitude) !== parseCoordinate(initial.latitude)) body.latitude = parseCoordinate(values.latitude) ?? Number.NaN;
  if (parseCoordinate(values.longitude) !== parseCoordinate(initial.longitude)) body.longitude = parseCoordinate(values.longitude) ?? Number.NaN;
  if (values.phone.trim() !== initial.phone.trim()) body.phone = values.phone.trim();
  if (values.email.trim() !== initial.email.trim()) body.email = values.email.trim();
  if (values.kind !== initial.kind) body.kind = values.kind;
  if (!DAYS.every((day) => sameDay(values[day], initial[day]))) body.openingHours = hoursOf(values);
  return body;
}

export function formValuesOf(row: AdminBranch): BranchFormValues {
  return {
    name: row.name,
    city: row.city,
    address: row.address,
    latitude: String(row.latitude),
    longitude: String(row.longitude),
    phone: row.phone,
    email: row.email,
    kind: row.kind,
    weekdays: dayFromApi(row.openingHours.weekdays),
    saturday: dayFromApi(row.openingHours.saturday),
    sunday: dayFromApi(row.openingHours.sunday),
  };
}

// ---------- What a save answers ----------
// `fields` maps a form field to the API's code for it. `usage` is what keeps a branch open (the reasons a closing is refused).
export type BranchSaveResult =
  | { status: "ok"; id: string; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "stale" }
  | { status: "in_use"; usage: BranchUsage }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

// A link to the place on the map, for a person who wants to check the point they typed. Any map works; this one needs no key.
export const mapLink = (latitude: number, longitude: number): string => `https://www.google.com/maps?q=${latitude},${longitude}`;
