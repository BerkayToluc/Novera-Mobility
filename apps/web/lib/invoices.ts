import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";
import type { StatusTone } from "@/components/admin/status-chip";

// The invoice screens (V2-37, docs/ADMIN.md §3.15 and docs/FLEET.md §4): what an invoice looks like, the lists' addresses, and what making
// the invoices or marking one paid answers. Pure, so the same rules are tested without a browser. Money is TRY kuruş.
type Schemas = components["schemas"];
export type Invoice = Schemas["Invoice"];
export type InvoiceLine = Schemas["InvoiceLine"];
export type InvoicePage = Schemas["InvoicePage"];
export type InvoiceGenerateResult = Schemas["InvoiceGenerateResult"];
export type InvoiceStatus = Invoice["status"];

export const INVOICE_STATUSES = ["PAID", "PENDING", "OVERDUE"] as const satisfies readonly InvoiceStatus[];

// The state is shown with a word as well as a colour: late is the one that asks for attention.
export const invoiceTone = (status: InvoiceStatus): StatusTone => (status === "PAID" ? "success" : status === "OVERDUE" ? "error" : "warning");

// The administrator's list: the newest invoice on top; `durum` in the address is `status` for the API.
export type InvoiceFilter = "durum";
export const ADMIN_INVOICE_LIST = {
  sortable: ["issuedAt", "dueAt", "number", "total"],
  defaultSort: { key: "issuedAt", dir: "desc" },
  filters: { durum: INVOICE_STATUSES },
} satisfies AdminListConfig<InvoiceFilter>;
export const FLEET_INVOICE_LIST = {
  sortable: ["period", "dueAt", "total"],
  defaultSort: { key: "period", dir: "desc" },
  filters: { durum: INVOICE_STATUSES },
} satisfies AdminListConfig<InvoiceFilter>;
export const INVOICE_API_FILTERS = { durum: "status" } as const;

// The months the administrator can make invoices for: this one and the eleven before it, newest first ("2026-10"). The API refuses a
// month that has not started; a month further back is allowed (a month that was missed).
export function billingPeriods(today: string, count = 12): string[] {
  const [year, month] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export const isPeriod = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// "2026-10" in the reader's language ("Ekim 2026", "October 2026").
export const periodLabel = (period: string, locale: string): string => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));

// What making the invoices answers. `already` is a month whose invoices are made; `future` a month that has not started.
export type GenerateResult =
  | { status: "ok"; period: string; created: number }
  | { status: "already" }
  | { status: "future" }
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };

// What marking an invoice paid (or taking it back) answers. `stale` is an invoice that changed since the screen read it.
export type PaidResult =
  | { status: "ok"; updatedAt: string }
  | { status: "stale" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
