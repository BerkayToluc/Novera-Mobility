"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "./api-request";
import { currentTime } from "./clock";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { requestFormErrors, toRequestBody, type RequestCancelResult, type RequestCreateResult, type RequestFormValues, type RequestMoveResult, type RequestStatus, type ServiceRequestCreated, type ServiceRequestDetail } from "./requests";
import { getSession } from "./session";

// The service request writes (V2-41): the customer opens and withdraws a request, the administrator moves it along. Each one asks first who
// is calling: the API checks the account and the company or the role on every call anyway (ADR-24, ADR-25), but the sample mode has no API,
// and an action is a public address, so it is checked here as well. The input is read with the same rules as the form (ADR-26).
const NUMBER = /^TLP-\d{4}-\d{5,}$/i;

async function companyOfCaller(): Promise<{ id: string } | null> {
  const session = await getSession();
  if (!session || session.type !== "corporate" || session.role !== "customer" || !session.hasFleet) return null;
  return { id: session.company?.id ?? "none" };
}

const refresh = <T>(result: T): T => {
  if ((result as { status?: string }).status === "ok") revalidatePath("/", "layout");
  return result;
};

const istanbulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(currentTime()));

// A new request. The position, when the phone gave one, arrives as two numbers; the address is the other way to say where.
export async function createRequest(values: RequestFormValues): Promise<RequestCreateResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "unavailable" };
  const bad = requestFormErrors(values, istanbulToday());
  if (Object.keys(bad).length > 0) return { status: "invalid", fields: Object.fromEntries(Object.keys(bad).map((name) => [name === "location" ? "address" : name, "INVALID_FORMAT"])) };

  if (isMockMode()) {
    const outcome = (await import("@/mocks/requests")).createMockRequest(await mockWorld(), company.id, values);
    return refresh(outcome.status === "ok" ? { status: "ok", number: outcome.value.number, similarOpen: outcome.value.similarOpen } : outcome);
  }
  const answer = await apiRequest<ServiceRequestCreated>("POST", "/fleet/requests", toRequestBody(values));
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok", number: answer.data.number, similarOpen: answer.data.similarOpen });
    case "invalid":
      return { status: "invalid", fields: answer.fieldErrors };
    case "forbidden":
      return { status: "forbidden" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    default:
      return { status: "unavailable" };
  }
}

// Withdrawing a request that nobody has taken up yet.
export async function cancelRequest(number: string): Promise<RequestCancelResult> {
  const company = await companyOfCaller();
  if (!company || !NUMBER.test(number)) return { status: "not_found" };

  if (isMockMode()) return refresh((await import("@/mocks/requests")).cancelMockRequest(await mockWorld(), company.id, number));
  const answer = await apiRequest<ServiceRequestDetail>("POST", "/fleet/requests/" + encodeURIComponent(number) + "/cancel", {});
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok" });
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    case "conflict":
      return answer.code === "INVALID_TRANSITION" ? { status: "not_allowed" } : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// Moving a request to a later step, with a note for the timeline and who is on it. Only the administrator.
export async function moveRequest(number: string, input: { status: RequestStatus; note: string; assignee: string | null }): Promise<RequestMoveResult> {
  if ((await getSession())?.role !== "admin") return { status: "not_found" };
  if (!NUMBER.test(number)) return { status: "not_found" };
  const note = input.note.trim();
  const assignee = input.assignee === null ? undefined : input.assignee.trim();
  const fields: Record<string, string> = {};
  if (note.length > 500) fields.note = "TOO_LONG";
  if ((assignee ?? "").length > 200) fields.assignee = "TOO_LONG";
  if (Object.keys(fields).length > 0) return { status: "invalid", fields };

  if (isMockMode()) {
    const outcome = (await import("@/mocks/requests")).moveMockRequest(await mockWorld(), number, input.status, note || null, assignee === undefined ? undefined : assignee || null);
    return refresh(outcome);
  }
  const answer = await apiRequest<ServiceRequestDetail>("POST", "/admin/requests/" + encodeURIComponent(number) + "/status", { status: input.status, ...(note ? { note } : {}), ...(assignee !== undefined ? { assignee } : {}) });
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok" });
    case "invalid":
      return { status: "invalid", fields: answer.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    case "conflict":
      return answer.code === "INVALID_TRANSITION" ? { status: "not_allowed" } : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}
