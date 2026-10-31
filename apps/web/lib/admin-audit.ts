import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The audit log screen (V2-34, docs/ADMIN.md §3.11): one line of the log as the administrator reads it, and the list's address.
// Read only. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminAuditEntry = Schemas["AdminAuditEntry"];
export type AdminAuditPage = Schemas["AdminAuditPage"];

// The kinds of record the log names (`entity`), for the filter. A kind that is not here is still shown on a line; it only has no
// name of its own in the filter.
export const AUDIT_ENTITIES = [
  "branch",
  "company",
  "contact-message",
  "extra",
  "promo-code",
  "quote",
  "reservation",
  "user",
  "vehicle",
  "vehicle-model",
] as const;

// The person at the terminal (`pnpm admin:create`) is no account; the API calls it `cli`.
export const CLI_ACTOR = "cli";

// The list has one order (newest first) and no sort. Its filters in the address are `yonetici` (who), `alan` (what kind of record),
// `bas` and `bit` (the days); `actor`, `entity`, `from` and `to` for the API. The days are free text here: the page drops one that
// is not a real day.
export type AuditFilter = "yonetici" | "alan" | "bas" | "bit";
export const AUDIT_LIST = {
  sortable: [],
  defaultSort: undefined,
  filters: { yonetici: null, alan: AUDIT_ENTITIES, bas: null, bit: null },
} satisfies AdminListConfig<AuditFilter>;
export const AUDIT_API_FILTERS = { yonetici: "actor", alan: "entity", bas: "from", bit: "to" } as const;

// A who that the API can take: an account id or `cli`. Anything else is left out of the query, so a made-up address shows the log.
export function validActor(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text === CLI_ACTOR || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : undefined;
}
