import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import enErrors from "../messages/en/errors.json";
import trErrors from "../messages/tr/errors.json";
import { parseRetryAfter, rateLimitMessage, waitMinutes } from "../lib/rate-limit";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("Retry-After", () => {
  it.each([
    ["30", 30],
    ["1", 1],
    ["900", 900],
    [null, null],
    ["", null],
    ["0", null],
    ["-5", null],
    ["soon", null],
    ["1.5", null],
    ["Wed, 21 Oct 2026 07:28:00 GMT", null],
  ])("%p is read as %p seconds", (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected);
  });

  it.each([
    [1, 1],
    [59, 1],
    [60, 1],
    [61, 2],
    [301, 6],
    [900, 15],
    [null, null],
    [undefined, null],
    [0, null],
  ])("%p seconds is shown as %p minutes (rounded up, at least one)", (seconds, minutes) => {
    expect(waitMinutes(seconds)).toBe(minutes);
  });
});

describe("the one text for every 429", () => {
  const tr = createTranslator({ locale: "tr", messages: trErrors, namespace: "RateLimit" });
  const en = createTranslator({ locale: "en", messages: enErrors, namespace: "RateLimit" });

  it("says how long to wait when the API said", () => {
    expect(rateLimitMessage(tr, 301)).toBe("Çok fazla deneme yaptınız. 6 dakika sonra tekrar deneyin.");
    expect(rateLimitMessage(en, 301)).toBe("Too many attempts. Please try again in 6 minutes.");
    expect(rateLimitMessage(en, 30)).toBe("Too many attempts. Please try again in 1 minute.");
  });

  it("says \"a while\" when it did not", () => {
    expect(rateLimitMessage(tr, null)).toBe("Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.");
    expect(rateLimitMessage(en, undefined)).toBe("Too many attempts. Please try again in a while.");
  });
});

describe("a 429 from the API reaches the caller with its wait", () => {
  const answer = (headers: Record<string, string>) =>
    vi.fn(async () => new Response(JSON.stringify({ code: "RATE_LIMITED", message: "x" }), { status: 429, headers }));

  it("apiPost and a server action carry Retry-After", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", answer({ "Retry-After": "120" }));
    const { apiPost } = await import("../lib/api-request");
    expect(await apiPost("/contact", {})).toEqual({ status: "rate_limited", retryAfter: 120 });
    const { forgotPassword } = await import("../lib/password-reset-actions");
    expect(await forgotPassword("ece@example.com")).toEqual({ ok: false, reason: "rate_limited", retryAfter: 120 });
  });

  it("a 429 with no usable header has no wait", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", answer({ "Retry-After": "later" }));
    const { apiPost } = await import("../lib/api-request");
    expect(await apiPost("/contact", {})).toEqual({ status: "rate_limited", retryAfter: null });
  });
});
