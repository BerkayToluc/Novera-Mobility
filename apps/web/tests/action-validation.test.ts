import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, saveNotifications, updateProfile } from "../lib/account-actions";
import { signIn, signInWithGoogle, signUp } from "../lib/auth-actions";
import { sendContact } from "../lib/contact-actions";
import { forgotPassword, resetPassword } from "../lib/password-reset-actions";
import { savePreferences } from "../lib/preferences-actions";
import { submitQuote } from "../lib/quote-actions";
import { checkLicence, placeReservation } from "../app/[locale]/odeme/actions";

// ADR-26: a server action is a public endpoint, so a body of the wrong shape (a number where text is
// expected, an object where a flag is) must come back as an answer, never as an exception.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("../lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/session")>()),
  getSession: async () => ({ id: "u1" }),
}));

// Nothing here may reach the API: every call below is rejected before it.
const fetchSpy = vi.fn(async () => new Response(null, { status: 500 }));
beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("API_URL", "http://api.test");
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
});

// Wrong in every way a form could not produce: numbers, objects, null, arrays, missing values.
const garbage = [42, null, undefined, {}, [], { name: 1, email: {}, message: [], consent: "yes", website: 3 }] as const;
const asAny = (value: unknown) => value as never;

describe("server actions reject a body of the wrong shape", () => {
  it.each(garbage)("sendContact(%j) answers invalid", async (value) => {
    const result = await sendContact(asAny(value));
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("sendContact names the fields that failed", async () => {
    const result = await sendContact(asAny({ name: 1, email: "x", phone: "", topic: "general", message: "short", consent: false, website: "" }));
    expect(result).toEqual({ ok: false, reason: "invalid", fields: expect.arrayContaining(["name", "email", "message", "consent"]) });
  });

  it("sendContact still looks like success to a bot that filled the honeypot", async () => {
    expect(await sendContact(asAny({ website: "http://spam.example" }))).toEqual({ ok: true, reference: null });
  });

  it.each(garbage)("submitQuote(%j) answers invalid", async (value) => {
    expect(await submitQuote(asAny(value))).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("submitQuote rejects needs that are not a list of known needs", async () => {
    const result = await submitQuote(asAny({ company: "Acme", contactName: "Ece", email: "e@x.com", phone: "05321234567", fleetSize: "1-5", term: "12", needs: 5, cities: "Izmir", note: "", product: "", consent: true, website: "" }));
    expect(result).toEqual({ ok: false, reason: "invalid", fields: ["needs"] });
  });

  it.each([42, null, {}, [], { a: 1 }])("signIn with email %j does not throw", async (value) => {
    expect(await signIn("individual", asAny(value), asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it("signIn rejects an account kind that is neither tab", async () => {
    expect(await signIn(asAny("admin"), "a@b.com", "x")).toEqual({ ok: false, reason: "invalid" });
  });

  it.each(garbage)("signUp(%j) answers invalid", async (value) => {
    expect(await signUp(asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it("signUp applies the one password rule", async () => {
    const body = { firstName: "Ece", lastName: "Aydın", email: "e@x.com", consent: true };
    expect(await signUp({ ...body, password: "short" })).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([42, null, {}, ["a"]])("signInWithGoogle(%j) answers invalid_token", async (value) => {
    expect(await signInWithGoogle(asAny(value), asAny({}))).toEqual({ ok: false, reason: "invalid_token" });
  });

  it.each([42, null, {}, ["a"]])("forgotPassword(%j) answers invalid", async (value) => {
    expect(await forgotPassword(asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it("resetPassword answers a wrong link or a short password without throwing", async () => {
    expect(await resetPassword(asAny(42), "long-enough-1")).toEqual({ ok: false, reason: "invalid_link" });
    expect(await resetPassword("token", asAny({}))).toEqual({ ok: false, reason: "too_short" });
    expect(await resetPassword("token", "short")).toEqual({ ok: false, reason: "too_short" });
  });

  it.each(garbage)("updateProfile(%j) answers invalid", async (value) => {
    expect(await updateProfile(asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it("changePassword uses the same password rule as sign-up and refuses the old password", async () => {
    expect(await changePassword("old-password", "short")).toEqual({ ok: false, reason: "invalid" });
    expect(await changePassword("same-password", "same-password")).toEqual({ ok: false, reason: "invalid" });
    expect(await changePassword(asAny(1), asAny({}))).toEqual({ ok: false, reason: "invalid" });
  });

  it.each(garbage)("savePreferences(%j) answers invalid", async (value) => {
    expect(await savePreferences(asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([42, null, {}, { reminders: "yes", campaigns: 1 }])("saveNotifications(%j) answers invalid", async (value) => {
    expect(await saveNotifications(asAny(value))).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([42, null, [], "x"])("placeReservation(params %j) answers invalid", async (value) => {
    expect(await placeReservation(asAny(value), asAny({}))).toEqual({ ok: false, reason: "invalid" });
  });

  it.each(garbage)("checkLicence(%j) does not throw", async (value) => {
    expect(await checkLicence(asAny(value))).toBe("not_found");
  });

});
