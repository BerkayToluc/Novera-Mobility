"use server";

import { apiPost } from "./api-request";
import { quoteToApi } from "./api-forms";
import { quoteSchema, type QuoteErrorMessages, type QuoteInput } from "./quote";
import { isMockMode } from "./mode";
import { codeMessages, invalidFields } from "./validation";

const messages = codeMessages<QuoteErrorMessages>();

export type SubmitQuoteResult =
  | { ok: true; reference: string }
  // `fields`: the form fields the server rejected, for the form to mark; empty when the body had no fields.
  | { ok: false; reason: "invalid"; fields: string[] }
  | { ok: false; reason: "unavailable" | "rate_limited"; retryAfter?: number | null };

// Sends the corporate request (ARCHITECTURE ADR-20, BACKLOG Y35). With API_URL set it is
// `POST /quotes`: the answer carries the reference (TKL-2026-00042). Without it, and with
// USE_MOCKS=1, the request is accepted with a made-up reference so the flow can be tried; with
// neither, the visitor is told the service is unavailable, so a production build never claims a
// request is being handled when nobody will see it.
export async function submitQuote(input: QuoteInput): Promise<SubmitQuoteResult> {
  // A filled honeypot is a bot: answer as if it worked and keep nothing (ADR-20).
  if (isFilled(input)) return { ok: true, reference: makeReference() };

  // The same schema the form uses, so the two cannot drift apart (ADR-26); the browser's check is for
  // comfort, this one is the one that counts.
  const parsed = quoteSchema(messages).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", fields: invalidFields(parsed.error) };
  input = parsed.data;

  if (process.env.API_URL) {
    const result = await apiPost<{ received: true; referenceNumber?: string | null }>("/quotes", quoteToApi(input));
    if (result.status === "ok") return { ok: true, reference: result.data.referenceNumber ?? makeReference() };
    // The API's own trap caught it: look the same as success (ADR-20).
    if (result.status === "spam") return { ok: true, reference: makeReference() };
    if (result.status === "invalid") return { ok: false, reason: "invalid", fields: [] };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited", retryAfter: result.retryAfter };
    return { ok: false, reason: "unavailable" };
  }

  if (isMockMode()) return { ok: true, reference: makeReference() };
  return { ok: false, reason: "unavailable" };
}

// A honeypot that is filled is a bot, whatever else is wrong with the body.
function isFilled(input: unknown): boolean {
  return typeof input === "object" && input !== null && typeof (input as { website?: unknown }).website === "string" && (input as { website: string }).website !== "";
}

// The real prefix is TKL (the sample one used to be NVK).
function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `TKL-${year}-${serial}`;
}
