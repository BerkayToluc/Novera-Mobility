"use server";

import { apiPost } from "./api-post";
import { contactToApi } from "./api-forms";
import { contactSchema, type ContactErrorMessages, type ContactInput } from "./contact";
import { isMockMode } from "./mode";
import { codeMessages, invalidFields } from "./validation";

const messages = codeMessages<ContactErrorMessages>();

// `reference` is null when the API gives no number: `POST /contact` answers only `{ received: true }`
// (the backend's proposal, option A, 16 October), and the confirmation then leaves the line out.
export type SendContactResult =
  | { ok: true; reference: string | null }
  // `fields`: the form fields the server rejected, for the form to mark; empty when the body had no fields.
  | { ok: false; reason: "invalid"; fields: string[] }
  | { ok: false; reason: "unavailable" | "rate_limited"; retryAfter?: number | null };

// Sends a contact message (ARCHITECTURE ADR-20, BACKLOG Y34). With API_URL set it is
// `POST /contact`. Without it, and with USE_MOCKS=1, the message is accepted with a made-up
// reference so the flow can be tried; with neither, the visitor is told the service is
// unavailable, so a production build never claims a message was received when nobody will read it.
export async function sendContact(input: ContactInput): Promise<SendContactResult> {
  // A filled honeypot is a bot: answer as if it worked and keep nothing (ADR-20).
  if (isFilled(input)) return { ok: true, reference: null };

  // The same schema the form uses, so the two cannot drift apart (ADR-26); the browser's check is for
  // comfort, this one is the one that counts.
  const parsed = contactSchema(messages).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", fields: invalidFields(parsed.error) };
  input = parsed.data;

  if (process.env.API_URL) {
    const result = await apiPost<{ received: true }>("/contact", contactToApi(input));
    // "spam" is the API's trap: the visitor sees the same success (ADR-20).
    if (result.status === "ok" || result.status === "spam") return { ok: true, reference: null };
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

function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `MSJ-${year}-${serial}`;
}
