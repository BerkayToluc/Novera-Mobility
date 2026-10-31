"use server";

import { revalidatePath } from "next/cache";
import { isPeriod, type GenerateResult, type Invoice, type InvoiceGenerateResult, type PaidResult } from "./invoices";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";

// The invoice writes of the panel (V2-37). Each one asks first who is calling: the API checks the role on every call anyway (ADR-24), but
// the sample mode has no API, and an action is a public address, so it is checked here as well. The input is read the way the API reads
// it: a month is a month, and anything else is refused before a call is made.
async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

function generateAnswer(period: string, result: ApiResult<InvoiceGenerateResult>): GenerateResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", period: result.data.period, created: result.data.created };
    case "invalid":
      return result.fieldErrors.period === "OUT_OF_RANGE" ? { status: "future" } : { status: "invalid" };
    case "conflict":
      return result.code === "ALREADY_GENERATED" ? { status: "already" } : { status: "unavailable" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    default:
      void period;
      return { status: "unavailable" };
  }
}

// Making a month's invoices for every company that has a contract in it. A month that was made is refused, nothing changes.
export async function generateInvoices(period: string): Promise<GenerateResult> {
  if (!(await isAdministrator())) return { status: "unavailable" };
  if (!isPeriod(period)) return { status: "invalid" };

  let result: GenerateResult;
  if (isMockMode()) {
    const outcome = (await import("@/mocks/invoices")).generateMockInvoices(await mockWorld(), period);
    result = outcome;
  } else {
    result = generateAnswer(period, await apiRequest<InvoiceGenerateResult>("POST", "/admin/invoices/generate?period=" + encodeURIComponent(period)));
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}

// Marking an invoice paid, or taking the mark back. The version is the one the screen read, so an invoice changed in the meantime is not
// overwritten by a stale screen.
export async function setInvoicePaid(number: string, updatedAt: string, paid: boolean): Promise<PaidResult> {
  if (!(await isAdministrator())) return { status: "not_found" };

  let result: PaidResult;
  if (isMockMode()) {
    const outcome = (await import("@/mocks/invoices")).setMockInvoicePaid(await mockWorld(), number, updatedAt, paid);
    result = outcome.status === "ok" ? { status: "ok", updatedAt: outcome.value.updatedAt } : { status: outcome.status };
  } else {
    const answer = await apiRequest<Invoice>("PATCH", "/admin/invoices/" + encodeURIComponent(number), { updatedAt, paid });
    switch (answer.status) {
      case "ok":
        result = { status: "ok", updatedAt: answer.data.updatedAt };
        break;
      case "not_found":
        result = { status: "not_found" };
        break;
      case "rate_limited":
        result = { status: "rate_limited", retryAfter: answer.retryAfter };
        break;
      case "conflict":
        result = answer.code === "STALE_WRITE" ? { status: "stale" } : { status: "unavailable" };
        break;
      default:
        result = { status: "unavailable" };
    }
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
