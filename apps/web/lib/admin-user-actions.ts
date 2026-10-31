"use server";

import { revalidatePath } from "next/cache";
import type { AdminUserDetail, UserActionResult } from "./admin-users";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";

// Closing and opening an account from the panel (V2-34). It asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. Both can be
// repeated (closing a closed account changes nothing), so there is no version to send.
async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

const path = (id: string, what: "disable" | "enable") => "/admin/users/" + encodeURIComponent(id) + "/" + what;

function answer(result: ApiResult<AdminUserDetail>): UserActionResult {
  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "forbidden":
      return { status: "forbidden" };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    default:
      return { status: "unavailable" };
  }
}

async function change(id: string, what: "disable" | "enable"): Promise<UserActionResult> {
  if (!(await isAdministrator())) return { status: "not_found" };

  let result: UserActionResult;
  if (isMockMode()) {
    const mocks = await import("@/mocks/admin-users");
    result = (what === "disable" ? mocks.disableMockUser : mocks.enableMockUser)(await mockWorld(), id);
  } else {
    result = answer(await apiRequest<AdminUserDetail>("POST", path(id, what)));
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

export async function disableUser(id: string): Promise<UserActionResult> {
  return change(id, "disable");
}

export async function enableUser(id: string): Promise<UserActionResult> {
  return change(id, "enable");
}
