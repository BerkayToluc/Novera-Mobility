"use server";

import { CONTACT_TOPICS, type ContactInput } from "./contact";

export type SendContactResult = { ok: true; reference: string } | { ok: false; reason: "unavailable" | "invalid" };

// Sends a contact message (ARCHITECTURE ADR-20). `POST /contact` does not exist yet (BACKLOG
// Y34): with USE_MOCKS=1 the message is accepted with a made-up reference so the flow can be
// tried; without it the visitor is told the service is unavailable, so a production build never
// claims a message was received when nobody will read it.
export async function sendContact(input: ContactInput): Promise<SendContactResult> {
  // A filled honeypot is a bot: answer as if it worked and keep nothing (ADR-20).
  if (input.website !== "") return { ok: true, reference: makeReference() };

  // The browser validated already; this is the server's own minimal check, not a copy of it.
  const plausible =
    input.consent === true &&
    input.name.trim() !== "" &&
    input.email.includes("@") &&
    input.message.trim() !== "" &&
    (CONTACT_TOPICS as readonly string[]).includes(input.topic);
  if (!plausible) return { ok: false, reason: "invalid" };

  if (process.env.USE_MOCKS === "1") return { ok: true, reference: makeReference() };
  return { ok: false, reason: "unavailable" };
}

function makeReference() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `MSJ-${year}-${serial}`;
}
