"use server";

import { revalidatePath } from "next/cache";
import { noteFormSchema, type AdminQuoteDetail, type NoteMessages, type QuoteSaveResult, type QuoteStatusValue } from "./admin-quotes";
import { apiRequest, type ApiResult } from "./api-request";
import { isMockMode } from "./mode";
import { mockWorld } from "./mock-world";
import { getSession } from "./session";
import { codeMessages } from "./validation";

// The quote request writes of the panel (V2-32). Each one asks first who is calling: the API checks the role on every call anyway
// (ADR-24), but the sample mode has no API, and an action is a public address, so it is checked here as well. The note is read
// with the same schema as the form (ADR-26).
const messages = codeMessages<NoteMessages>();

async function isAdministrator(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

const path = (number: string) => "/admin/quotes/" + encodeURIComponent(number);

// An answer of the API, in the words the screen works with.
function answer(result: ApiResult<AdminQuoteDetail>): QuoteSaveResult {
  switch (result.status) {
    case "ok":
      return { status: "ok", updatedAt: result.data.updatedAt };
    case "invalid":
      return { status: "invalid", fields: result.fieldErrors };
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", retryAfter: result.retryAfter };
    case "conflict":
      if (result.code === "STALE_WRITE") return { status: "stale" };
      if (result.code === "INVALID_TRANSITION") return { status: "invalid_transition" };
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

type Change = { status?: QuoteStatusValue; note?: string };

// A request only goes forward and the API refuses a step back (`INVALID_TRANSITION`, nothing changes). `updatedAt` is the version
// the screen was opened at; the API answers STALE_WRITE if the request moved on since. The customer's own list shows the new state
// from the next read; the note is never part of it.
export async function updateQuote(number: string, updatedAt: string, change: Change): Promise<QuoteSaveResult> {
  if (!(await isAdministrator())) return { status: "not_found" };
  let note: string | undefined;
  if (change.note !== undefined) {
    const parsed = noteFormSchema(messages).safeParse({ note: change.note });
    if (!parsed.success) return { status: "invalid", fields: { internalNote: "TOO_LONG" } };
    note = parsed.data.note;
  }
  // An empty note clears it.
  const body = { updatedAt, ...(change.status !== undefined ? { status: change.status } : {}), ...(note !== undefined ? { internalNote: note === "" ? null : note } : {}) };

  let result: QuoteSaveResult;
  if (isMockMode()) {
    const outcome = (await import("@/mocks/admin-quotes")).updateMockQuote(await mockWorld(), number, body);
    result = outcome.status === "ok" ? { status: "ok", updatedAt: outcome.value.updatedAt } : outcome;
  } else {
    result = answer(await apiRequest<AdminQuoteDetail>("PATCH", path(number), body));
  }
  if (result.status === "ok") revalidatePath("/", "layout");
  return result;
}
