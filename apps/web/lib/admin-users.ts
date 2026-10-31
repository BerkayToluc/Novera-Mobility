import type { AdminListConfig } from "./admin-query";
import type { components } from "./api-types";

// The account screens (V2-34, docs/ADMIN.md §3.11): what an account looks like to the administrator, the list's address, and what
// closing or opening one answers. Pure, so the same rules are tested without a browser.
type Schemas = components["schemas"];
export type AdminUser = Schemas["AdminUserListItem"];
export type AdminUserDetail = Schemas["AdminUserDetail"];
export type AdminUserPage = Schemas["AdminUserPage"];
export type AdminUserType = Schemas["AdminUserType"];
export type AdminUserStatus = Schemas["AdminUserStatus"];

export const USER_TYPES = ["INDIVIDUAL", "CORPORATE", "ADMIN"] as const satisfies readonly AdminUserType[];
export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const satisfies readonly AdminUserStatus[];

// The list: what it can be sorted by (the API's names), the default order (the newest account on top), and the two filters in the
// address (`tur`, `durum`; `type`, `status` for the API).
export type UserFilter = "tur" | "durum";
export const USER_LIST = {
  sortable: ["createdAt", "email", "lastName"],
  defaultSort: { key: "createdAt", dir: "desc" },
  filters: { tur: USER_TYPES, durum: USER_STATUSES },
} satisfies AdminListConfig<UserFilter>;
export const USER_API_FILTERS = { tur: "type", durum: "status" } as const;

// What closing or opening an account answers. `forbidden` is an administrator's account: it is not closed from here.
export type UserActionResult =
  | { status: "ok" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "rate_limited"; retryAfter: number | null };
