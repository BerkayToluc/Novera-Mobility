import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The booking screens (V2-31, docs/ADMIN.md §3.2): what a booking looks like to the administrator, the list's address, and the
// reason a cancellation needs. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminReservation = Schemas["AdminReservationListItem"];
export type AdminReservationDetail = Schemas["AdminReservationDetail"];
export type AdminReservationPage = Schemas["AdminReservationPage"];

export const RESERVATION_STATUSES = ["CONFIRMED", "CANCELLED"] as const;

// The list: what it can be sorted by (the API's names), the default order (the latest start on top), and the four filters in the
// address (`durum`, `bayi`, `bas`, `bit`; `status`, `branch`, `from`, `to` for the API). The branch and the days are free text
// here (up to 100 characters, as the address helper reads it): the API checks them, and the page drops a day that is not one.
export type ReservationFilter = "durum" | "bayi" | "bas" | "bit" | "baslangic" | "bitis" | "olusturma";
// `baslangic`, `bitis` and `olusturma` are the three numbers of the summary (V2-25) as lists: the cards open the list with them.
// Each takes the one value the card means (today's rentals, the seven days).
export const QUICK_FILTERS = { baslangic: "bugun", bitis: "bugun", olusturma: "7gun" } as const;
export const RESERVATION_LIST = {
  sortable: ["startAt", "createdAt", "number"],
  defaultSort: { key: "startAt", dir: "desc" },
  filters: { durum: RESERVATION_STATUSES, bayi: null, bas: null, bit: null, baslangic: ["bugun"], bitis: ["bugun"], olusturma: ["7gun"] },
} satisfies AdminListConfig<ReservationFilter>;
// What the API calls them, and the API's own word for the value ("bugun" is `today`, "7gun" is `last7days`).
export const RESERVATION_API_FILTERS = { durum: "status", bayi: "branch", bas: "from", bit: "to", baslangic: "start", bitis: "end", olusturma: "created" } as const;
export const QUICK_API_VALUES = { baslangic: "today", bitis: "today", olusturma: "last7days" } as const;

// A day as the date field writes it, "2026-10-30", that is a real one. Anything else is left out of the query, so a made-up
// address shows the list instead of an error page.
export function validDay(text: string | undefined): string | undefined {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const [year, month, day] = text.split("-").map(Number) as [number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  const same = real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
  return same && year >= 2000 && year <= 2100 ? text : undefined;
}

// Where a booking is in its life, from its dates and state: ahead, under way, finished, cancelled.
export type AdminReservationPhase = "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export function adminPhase(row: Pick<AdminReservation, "status" | "startAt" | "endAt">, now: number): AdminReservationPhase {
  if (row.status === "CANCELLED") return "CANCELLED";
  if (new Date(row.startAt).getTime() > now) return "UPCOMING";
  return new Date(row.endAt).getTime() > now ? "ACTIVE" : "COMPLETED";
}

// ---------- The reason of a cancellation ----------
export const MIN_REASON = 5;
export const MAX_REASON = 500;

export type CancelMessages = { reason: string };

// The same schema the dialog and the server action use, so the two cannot drift apart (ADR-26).
export const cancelFormSchema = (m: CancelMessages) =>
  z.object({ reason: z.string().trim().min(MIN_REASON, m.reason).max(MAX_REASON, m.reason) });

// What a cancellation answers. `usage` is not needed: the only refusal the API gives is that the booking cannot be cancelled now.
export type CancelResult =
  | { status: "ok" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "not_cancellable" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
