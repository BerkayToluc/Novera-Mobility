import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import { feeToKurus, isDay } from "./admin-contracts";
import type { components } from "./api-types";
import type { StatusTone } from "@/components/admin/status-chip";

// The expense screens (V2-38, docs/ADMIN.md §3.16 and docs/FLEET.md §3, §3.1): what an expense looks like, the lists' addresses, the form of
// the administrator, and what the writes answer. Pure, so the same rules are tested without a browser. Money is TRY kuruş.
type Schemas = components["schemas"];
export type FleetExpense = Schemas["FleetExpense"];
export type FleetExpensePage = Schemas["FleetExpensePage"];
export type ExpenseType = Schemas["FleetExpenseType"];
export type ExpenseStatus = Schemas["FleetExpenseStatus"];
export type ReflectBody = Schemas["FleetExpenseReflectResult"];

export const EXPENSE_TYPES = ["HGS", "PENALTY", "MAINTENANCE", "OTHER"] as const satisfies readonly ExpenseType[];
export const EXPENSE_STATUSES = ["OPEN", "REFLECTED", "DISPUTED"] as const satisfies readonly ExpenseStatus[];

// A state is shown with a word as well as a colour: open is the one that asks for a decision.
export const expenseTone = (status: ExpenseStatus): StatusTone => (status === "REFLECTED" ? "success" : status === "DISPUTED" ? "error" : "warning");

// ---------- The lists' addresses ----------
// The addresses stay in Turkish for the filters (`tur`, `durum`), the API's own names are English (`type`, `status`). A value that is not one
// of the allowed ones falls back to the default, so a made-up address shows the list instead of an error (lib/admin-query.ts).
export type ExpenseFilter = "tur" | "durum";
export const ADMIN_EXPENSE_LIST = {
  sortable: ["occurredAt", "amount"],
  defaultSort: { key: "occurredAt", dir: "desc" },
  filters: { tur: EXPENSE_TYPES, durum: EXPENSE_STATUSES },
} satisfies AdminListConfig<ExpenseFilter>;
export const EXPENSE_API_FILTERS = { tur: "type", durum: "status" } as const;

// The customer's list can also be narrowed to a car (`arac`), a person (`personel`, or `yok` for the expenses nobody had the car for) and
// the days from and to (`bas`, `bit`, Istanbul days, both included). Those values are free, so they are checked below before they go to
// the API: a made-up address shows the list, not an error.
export type FleetExpenseFilter = ExpenseFilter | "arac" | "personel" | "bas" | "bit";
export const FLEET_EXPENSE_LIST = {
  sortable: ["occurredAt", "amount"],
  defaultSort: { key: "occurredAt", dir: "desc" },
  filters: { tur: EXPENSE_TYPES, durum: EXPENSE_STATUSES, arac: null, personel: null, bas: null, bit: null },
} satisfies AdminListConfig<FleetExpenseFilter>;
export const FLEET_EXPENSE_API_FILTERS = { tur: "type", durum: "status", arac: "vehicle", personel: "employee", bas: "from", bit: "to" } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The free values that are not what they should be are dropped.
export function cleanFleetExpenseFilters<T extends Partial<Record<FleetExpenseFilter, string>>>(filters: T): T {
  const clean = { ...filters };
  if (clean.arac !== undefined && !UUID.test(clean.arac)) delete clean.arac;
  if (clean.personel !== undefined && clean.personel !== "yok" && !UUID.test(clean.personel)) delete clean.personel;
  if (clean.bas !== undefined && !isDay(clean.bas)) delete clean.bas;
  if (clean.bit !== undefined && !isDay(clean.bit)) delete clean.bit;
  return clean;
}

// ---------- The administrator's form ----------
export type ExpenseFormValues = { plate: string; type: string; occurredAt: string; amount: string; description: string; place: string };
export const EMPTY_EXPENSE_FORM: ExpenseFormValues = { plate: "", type: "HGS", occurredAt: "", amount: "", description: "", place: "" };
export type ExpenseFormMessages = { plate: string; type: string; occurredAt: string; amount: string; description: string; place: string };

export const MAX_DESCRIPTION = 200;
export const MAX_PLACE = 100;

// The moment is typed in the browser's date-time field ("2026-10-31T09:30") and means Istanbul time, the way every day of the fleet does.
// Nothing in the future; the check here is the form's comfort, the API says it again (it has the clock).
export function isMoment(text: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  return match !== null && isDay(match[1]!);
}

export const momentToIso = (text: string): string => new Date(`${text.trim()}:00+03:00`).toISOString();

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26).
export const expenseFormSchema = (m: ExpenseFormMessages) =>
  z.object({
    plate: z.string().trim().min(1, m.plate).max(30, m.plate),
    type: z.string().refine((value) => (EXPENSE_TYPES as readonly string[]).includes(value), m.type),
    occurredAt: z.string().refine(isMoment, m.occurredAt),
    amount: z.string().refine((value) => feeToKurus(value) !== null, m.amount),
    description: z.string().trim().max(MAX_DESCRIPTION, m.description),
    place: z.string().trim().max(MAX_PLACE, m.place),
  });

type CreateBody = Schemas["FleetExpenseCreate"];
export function toExpenseBody(values: ExpenseFormValues): CreateBody {
  const body: CreateBody = { plate: values.plate.trim(), type: values.type as ExpenseType, occurredAt: momentToIso(values.occurredAt), amount: feeToKurus(values.amount)! };
  if (values.description.trim()) body.description = values.description.trim();
  if (values.place.trim()) body.place = values.place.trim();
  return body;
}

// ---------- Who an expense belongs to (docs/FLEET.md §3.1) ----------
// The person is whoever had the car at the moment of the expense: the assignment that started at or before it and had not ended by then.
// An assignment ends the instant the next one starts, and that moment belongs to the one that starts. The same rule as the API's
// (apps/api/src/fleet/expense-calc.ts); the sample mode uses this one.
export type Span = { employeeId: string; startedAt: string; endedAt: string | null };
export function assigneeAt<T extends Span>(spans: readonly T[], at: string): T | null {
  const moment = Date.parse(at);
  let found: T | null = null;
  for (const span of spans) {
    if (Date.parse(span.startedAt) > moment) continue;
    if (span.endedAt !== null && Date.parse(span.endedAt) <= moment) continue;
    if (found === null || Date.parse(span.startedAt) > Date.parse(found.startedAt)) found = span;
  }
  return found;
}

// What the customer may do to an expense: open can be reflected or disputed, a dispute can be taken back, a reflected one is final.
export function canMove(from: ExpenseStatus, to: ExpenseStatus): boolean {
  if (from === to) return true;
  if (from === "OPEN") return to === "REFLECTED" || to === "DISPUTED";
  return from === "DISPUTED" && to === "OPEN";
}

// Which of the shown expenses can be reflected right now: the open ones that had a person. The button counts these, so it never promises
// more than the API will do.
export const isReflectable = (row: Pick<FleetExpense, "status" | "employee">): boolean => row.status === "OPEN" && row.employee !== null;

// ---------- What the writes answer ----------
export type ExpenseSaveResult =
  | { status: "ok" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "rate_limited"; retryAfter: number | null }
  | { status: "unavailable" };

export type ExpenseStatusResult =
  | { status: "ok" }
  | { status: "stale" | "not_allowed" | "not_found" | "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

export type ReflectResult =
  | { status: "ok"; reflected: number; skipped: number }
  | { status: "not_found" | "invalid" | "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

export type RenewalResult =
  | { status: "ok"; referenceNumber: string }
  | { status: "already" | "not_found" | "invalid" | "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
