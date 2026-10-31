"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import {
  expenseFormSchema,
  toExpenseBody,
  type ExpenseFormMessages,
  type ExpenseFormValues,
  type ExpenseSaveResult,
  type ExpenseStatus,
  type ExpenseStatusResult,
  type FleetExpense,
  type ReflectBody,
  type ReflectResult,
  type RenewalResult,
} from "./expenses";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages, invalidFields } from "./validation";

// The expense writes (V2-38): the administrator enters one by the plate; the customer reflects, disputes and asks for a renewal. Each one
// asks first who is calling: the API checks the role or the company on every call anyway (ADR-24, ADR-25), but the sample mode has no API,
// and an action is a public address, so it is checked here as well. The input is read with the same schema as the form (ADR-26).
const messages = codeMessages<ExpenseFormMessages>();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

// The company of the signed-in corporate account that has a fleet, or null: anyone else is turned away as if the page did not exist.
async function companyOfCaller(): Promise<{ id: string } | null> {
  const session = await getSession();
  if (!session || session.type !== "corporate" || session.role !== "customer" || !session.hasFleet) return null;
  return { id: session.company?.id ?? "none" };
}

const failed = (error: ZodError): { status: "invalid"; fields: Record<string, string> } => ({
  status: "invalid",
  fields: Object.fromEntries(invalidFields(error).map((name) => [name, "INVALID_FORMAT"])),
});

const refresh = <T>(result: T): T => {
  if ((result as { status?: string }).status === "ok") revalidatePath("/", "layout");
  return result;
};

// ---------- The administrator ----------
export async function createExpense(input: ExpenseFormValues): Promise<ExpenseSaveResult> {
  if (!(await isAdministrator())) return { status: "unavailable" };
  const parsed = expenseFormSchema(messages).safeParse(input);
  if (!parsed.success) return failed(parsed.error);
  const values = parsed.data as ExpenseFormValues;

  if (isMockMode()) {
    const outcome = (await import("@/mocks/expenses")).createMockExpense(await mockWorld(), values);
    return refresh(outcome.status === "ok" ? { status: "ok" } : outcome);
  }
  const answer = await apiRequest<FleetExpense>("POST", "/admin/fleet-expenses", toExpenseBody(values));
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok" });
    case "invalid":
      return { status: "invalid", fields: answer.fieldErrors };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    default:
      return { status: "unavailable" };
  }
}

// ---------- The customer ----------
// Open ↔ disputed, open → reflected. The version is the one the screen read, so an expense changed in the meantime is not overwritten.
export async function setExpenseStatus(id: string, updatedAt: string, status: ExpenseStatus): Promise<ExpenseStatusResult> {
  const company = await companyOfCaller();
  if (!company || !UUID.test(id)) return { status: "not_found" };

  if (isMockMode()) {
    const outcome = (await import("@/mocks/expenses")).setMockExpenseStatus(await mockWorld(), company.id, id, updatedAt, status);
    return refresh(outcome.status === "ok" ? { status: "ok" } : { status: outcome.status });
  }
  const answer = await apiRequest<FleetExpense>("PATCH", "/fleet/expenses/" + encodeURIComponent(id), { updatedAt, status });
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok" });
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    case "conflict":
      if (answer.code === "STALE_WRITE") return { status: "stale" };
      if (answer.code === "INVALID_TRANSITION") return { status: "not_allowed" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

// Many at once. An id that is not the company's refuses the whole call (the API answers 404 and changes nothing).
export async function reflectExpenses(ids: string[]): Promise<ReflectResult> {
  const company = await companyOfCaller();
  if (!company) return { status: "not_found" };
  if (ids.length === 0 || ids.length > 100 || !ids.every((id) => UUID.test(id))) return { status: "invalid" };

  if (isMockMode()) {
    const outcome = (await import("@/mocks/expenses")).reflectMockExpenses(await mockWorld(), company.id, ids);
    return refresh(outcome);
  }
  const answer = await apiRequest<ReflectBody>("POST", "/fleet/expenses/reflect", { ids });
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok", reflected: answer.data.reflected, skipped: answer.data.skipped.length });
    case "not_found":
      return { status: "not_found" };
    case "invalid":
      return { status: "invalid" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    default:
      return { status: "unavailable" };
  }
}

const NUMBER = /^SZL-\d{4}-\d{5,}$/i;

// "Yenileme talebi gönder": a quote request for the contract, which the sales team finds under Teklifler.
export async function requestRenewal(number: string, notes: string): Promise<RenewalResult> {
  const company = await companyOfCaller();
  if (!company || !NUMBER.test(number.trim())) return { status: "not_found" };
  const word = notes.trim();
  if (word.length > 500) return { status: "invalid" };

  if (isMockMode()) {
    const outcome = (await import("@/mocks/expenses")).requestMockRenewal(await mockWorld(), company.id, number.trim(), word || null);
    return refresh(outcome);
  }
  const answer = await apiRequest<components["schemas"]["RenewalReceived"]>("POST", "/fleet/contracts/" + encodeURIComponent(number.trim()) + "/renewal-request", word ? { notes: word } : {});
  switch (answer.status) {
    case "ok":
      return refresh({ status: "ok", referenceNumber: answer.data.referenceNumber });
    case "not_found":
      return { status: "not_found" };
    case "invalid":
      return { status: "invalid" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: answer.retryAfter };
    case "conflict":
      return answer.code === "ALREADY_REQUESTED" ? { status: "already" } : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}
