"use server";

import { QUOTE_NEEDS, type QuoteInput } from "./quote";

export type SubmitQuoteResult = { ok: true; reference: string } | { ok: false; reason: "unavailable" | "invalid" };

// Sends the corporate request (ARCHITECTURE ADR-20). `POST /quotes` does not exist yet
// (BACKLOG Y35): with USE_MOCKS=1 the request is accepted with a made-up reference so the
// flow can be tried; without it the visitor is told the service is unavailable, so a
// production build never claims a request is being handled when nobody will see it.
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

  if (process.env.USE_MOCKS === "1") return { ok: true, reference: makeReference() };
  return { ok: false, reason: "unavailable" };
}

function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `NVK-${year}-${serial}`;
}
