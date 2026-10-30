import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The contact message screens (V2-32, docs/ADMIN.md §3.2): what a message looks like to the administrator and the list's
// address. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminMessage = Schemas["AdminMessageListItem"];
export type AdminMessageDetail = Schemas["AdminMessageDetail"];
export type AdminMessagePage = Schemas["AdminMessagePage"];

// The one filter of the list, `durum` in the address: the messages still waiting, or the ones handled. The summary's "unhandled
// messages" card opens the list with `durum=ele-alinmadi`; the API calls it `handled=false`.
export const MESSAGE_STATES = ["ele-alinmadi", "ele-alindi"] as const;
export const MESSAGE_LIST = {
  sortable: ["createdAt"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { durum: MESSAGE_STATES },
} satisfies AdminListConfig<"durum">;
export const MESSAGE_API_VALUES = { "ele-alinmadi": "false", "ele-alindi": "true" } as const;

// What a mark answers.
export type MessageSaveResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
