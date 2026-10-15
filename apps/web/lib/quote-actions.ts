"use server";

import { apiPost } from "./api-post";
import { quoteToApi } from "./api-forms";
import { QUOTE_NEEDS, type QuoteInput } from "./quote";

export type SubmitQuoteResult =
  | { ok: true; reference: string }
  | { ok: false; reason: "unavailable" | "invalid" | "rate_limited" };

// Sends the corporate request (ARCHITECTURE ADR-20, BACKLOG Y35). With API_URL set it is
// `POST /quotes`: the answer carries the reference (TKL-2026-00042). Without it, and with
// USE_MOCKS=1, the request is accepted with a made-up reference so the flow can be tried; with
// neither, the visitor is told the service is unavailable, so a production build never claims a
// request is being handled when nobody will see it.
export async function submitQuote(input: QuoteInput): Promise<SubmitQuoteResult> {
  // A filled honeypot is a bot: answer as if it worked and keep nothing (ADR-20).
  if (input.website !== "") return { ok: true, reference: makeReference() };

  // The browser validated already; this is the server's own minimal check, not a copy of it.
  const plausible =
    input.consent === true &&
    input.company.trim() !== "" &&
    input.email.includes("@") &&
    Array.isArray(input.needs) &&
    input.needs.length > 0 &&
    input.needs.every((need) => (QUOTE_NEEDS as readonly string[]).includes(need));
  if (!plausible) return { ok: false, reason: "invalid" };

  if (process.env.API_URL) {
    const result = await apiPost<{ received: true; referenceNumber?: string | null }>("/quotes", quoteToApi(input));
    if (result.status === "ok") return { ok: true, reference: result.data.referenceNumber ?? makeReference() };
    // The API's own trap caught it: look the same as success (ADR-20).
    if (result.status === "spam") return { ok: true, reference: makeReference() };
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "unavailable" };
  }

  if (process.env.USE_MOCKS === "1") return { ok: true, reference: makeReference() };
  return { ok: false, reason: "unavailable" };
}

// The real prefix is TKL (the sample one used to be NVK).
function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `TKL-${year}-${serial}`;
}
