"use server";

import { apiPost } from "./api-post";
import { contactToApi } from "./api-forms";
import { CONTACT_TOPICS, type ContactInput } from "./contact";

// `reference` is null when the API gives no number: `POST /contact` answers only `{ received: true }`
// (the backend's proposal, option A, 16 October), and the confirmation then leaves the line out.
export type SendContactResult =
  | { ok: true; reference: string | null }
  | { ok: false; reason: "unavailable" | "invalid" | "rate_limited" };

// Sends a contact message (ARCHITECTURE ADR-20, BACKLOG Y34). With API_URL set it is
// `POST /contact`. Without it, and with USE_MOCKS=1, the message is accepted with a made-up
// reference so the flow can be tried; with neither, the visitor is told the service is
// unavailable, so a production build never claims a message was received when nobody will read it.
export async function sendContact(input: ContactInput): Promise<SendContactResult> {
  // A filled honeypot is a bot: answer as if it worked and keep nothing (ADR-20).
  if (input.website !== "") return { ok: true, reference: null };

  // The browser validated already; this is the server's own minimal check, not a copy of it.
  const plausible =
    input.consent === true &&
    input.name.trim() !== "" &&
    input.email.includes("@") &&
    input.message.trim() !== "" &&
    (CONTACT_TOPICS as readonly string[]).includes(input.topic);
  if (!plausible) return { ok: false, reason: "invalid" };

  if (process.env.API_URL) {
    const result = await apiPost<{ received: true }>("/contact", contactToApi(input));
    // "spam" is the API's trap: the visitor sees the same success (ADR-20).
    if (result.status === "ok" || result.status === "spam") return { ok: true, reference: null };
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "unavailable" };
  }

  if (process.env.USE_MOCKS === "1") return { ok: true, reference: makeReference() };
  return { ok: false, reason: "unavailable" };
}

function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `MSJ-${year}-${serial}`;
}
