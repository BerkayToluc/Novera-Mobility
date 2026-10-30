"use server";

import { revalidatePath } from "next/cache";
import { cancelFormSchema, type AdminReservationDetail, type CancelMessages, type CancelResult } from "./admin-reservations";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages } from "./validation";

// The cancellation of a booking from the panel (V2-31). It asks first who is calling: the API checks the role on every call
// anyway (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The reason
// is read with the same schema as the dialog (ADR-26).
const messages = codeMessages<CancelMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// An answer of the API, in the words the dialog works with.
function answer(result: ApiResult<AdminReservationDetail>): CancelResult {
  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      return result.code === "INVALID_TRANSITION" ? { status: "not_cancellable" } : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// A booking that has started, or is already cancelled, is refused by the API (`INVALID_TRANSITION`) and nothing changes. The
// customer's own list shows the cancellation from the next read.
export async function cancelReservationAction(number: string, reason: string): Promise<CancelResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  const parsed = cancelFormSchema(messages).safeParse({ reason });
  if (!parsed.success) return { status: "invalid", fields: { reason: "INVALID_FORMAT" } };

  let result: CancelResult;
  if (isMockMode()) {
    const outcome = (await import("@/mocks/admin-reservations")).cancelMockReservation(await mockWorld(), number, parsed.data.reason);
    result = outcome.status === "invalid" ? { status: "invalid", fields: outcome.fields } : { status: outcome.status };
  } else {
    result = answer(await apiRequest<AdminReservationDetail>("POST", "/admin/reservations/" + encodeURIComponent(number) + "/cancel", { reason: parsed.data.reason }));
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
