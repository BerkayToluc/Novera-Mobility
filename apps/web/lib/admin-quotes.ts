import { z } from "zod";
import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The quote request screens (V2-32, docs/ADMIN.md §3.2): what a request looks like to the administrator, the list's address, and
// the note the team writes on it. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminQuote = Schemas["AdminQuoteListItem"];
export type AdminQuoteDetail = Schemas["AdminQuoteDetail"];
export type AdminQuotePage = Schemas["AdminQuotePage"];
export type QuoteStatusValue = Schemas["QuoteStatus"];

export const QUOTE_STATUSES = ["RECEIVED", "IN_REVIEW", "OFFERED", "CLOSED"] as const satisfies readonly QuoteStatusValue[];
export const QUOTE_SOURCES = ["WEB", "FLEET_RENEWAL"] as const;

// The list: what it can be sorted by (the API's names), the default order (the newest on top), and the two filters in the address
// (`durum` and `kaynak`; `status` and `source` for the API). The summary's "waiting quotes" card opens it with `durum=RECEIVED`.
export const QUOTE_LIST = {
  sortable: ["createdAt", "number", "vehicleCount"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { durum: QUOTE_STATUSES, kaynak: QUOTE_SOURCES },
} satisfies AdminListConfig<"durum" | "kaynak">;
export const QUOTE_API_FILTERS = { durum: "status", kaynak: "source" } as const;

// A quote only goes forward. The API says which states are left (`nextStatuses`); this is the same rule for the screens that
// have only the state.
export const statusRank = (status: QuoteStatusValue): number => QUOTE_STATUSES.indexOf(status);
export const nextStatuses = (status: QuoteStatusValue): QuoteStatusValue[] => QUOTE_STATUSES.filter((entry) => statusRank(entry) > statusRank(status));

// ---------- The internal note ----------
export const MAX_NOTE = 2000;

export type NoteMessages = { note: string };

// The same schema the form and the server action use, so the two cannot drift apart (ADR-26). Empty clears the note.
export const noteFormSchema = (m: NoteMessages) => z.object({ note: z.string().trim().max(MAX_NOTE, m.note) });

// ---------- What a save answers ----------
export type QuoteSaveResult =
  | { status: "ok"; updatedAt: string }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "stale" }
  | { status: "invalid_transition" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
