"use server";

import { revalidatePath } from "next/cache";
import type { AdminMessageDetail, MessageSaveResult } from "./admin-messages";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";

// The "handled" mark of a contact message (V2-32). It asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well.
function answer(result: ApiResult<AdminMessageDetail>): MessageSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    default:
      return { status: "unavailable" };
  }
}

// Marking is repeatable (a message already handled keeps its first mark) and so is taking it back, so there is no version to send.
export async function setMessageHandled(id: string, handled: boolean): Promise<MessageSaveResult> {
  const session = await getSession();
  if (session?.role !== "admin") return { status: "not_found" };

  let result: MessageSaveResult;
  if (isMockMode()) {
    const who = { name: `${session.user.firstName} ${session.user.lastName}`.trim(), email: session.user.email };
    const outcome = (await import("@/mocks/admin-messages")).handleMockMessage(await mockWorld(), id, handled, who);
    result = { status: outcome.status };
  } else {
    result = answer(await apiRequest<AdminMessageDetail>("PATCH", "/admin/contact-messages/" + encodeURIComponent(id), { handled }));
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
