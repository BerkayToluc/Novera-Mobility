import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSessionCookie } from "../lib/session-cookie";

// A cookie jar the code under test writes to, and the cookies the "browser" sent.
const sent = new Map<string, string>();
const written = new Map<string, { value: string; options: Record<string, unknown> }>();
const deleted: string[] = [];

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({
    get: (name: string) => (sent.has(name) ? { value: sent.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => written.set(name, { value, options }),
    delete: (name: string) => deleted.push(name),
  }),
}));

const user = {
  id: "u1",
  email: "elif@example.com",
  firstName: "Elif",
  lastName: "Yıldız",
  accountType: "INDIVIDUAL",
  companyName: null,
  locale: "en",
  theme: "dark",
  currency: "EUR",
};

const answer = (status: number, body?: unknown, setCookie?: string) =>
  vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: setCookie ? [["set-cookie", setCookie]] : [],
      }),
  );

describe("parseSessionCookie", () => {
  it("reads the value and the expiry", () => {
    const parsed = parseSessionCookie([
      "other=1; Path=/",
      "novera_session=tok123; Path=/; Expires=Wed, 11 Nov 2026 10:00:00 GMT; HttpOnly; SameSite=Lax",
    ]);
    expect(parsed?.value).toBe("tok123");
    expect(parsed?.expires?.toISOString()).toBe("2026-11-11T10:00:00.000Z");
  });

  it("reads an emptied cookie as the end of the session, and ignores answers that do not touch it", () => {
    expect(parseSessionCookie(["novera_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"])?.value).toBe("");
    expect(parseSessionCookie(["other=1"])).toBeUndefined();
    expect(parseSessionCookie([])).toBeUndefined();
  });
});

describe("signing in against the API", () => {
  beforeEach(() => {
    sent.clear();
    written.clear();
    deleted.length = 0;
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("USE_MOCKS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("copies the API's session cookie onto the browser and applies the account's preferences", async () => {
    const { signIn } = await import("../lib/auth-actions");
    vi.stubGlobal("fetch", answer(200, user, "novera_session=tok123; Path=/; Expires=Wed, 11 Nov 2026 10:00:00 GMT; HttpOnly"));
    expect(await signIn("individual", "elif@example.com", "sifre-1234")).toEqual({ ok: true, locale: "en" });
    expect(written.get("novera_session")?.value).toBe("tok123");
    expect(written.get("novera_session")?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(written.get("novera-theme")?.value).toBe("dark");
    expect(written.get("novera-currency")?.value).toBe("EUR");
  });

  it("says a wrong password is invalid, and a service that is down is unavailable", async () => {
    const { signIn } = await import("../lib/auth-actions");
    vi.stubGlobal("fetch", answer(401, { code: "INVALID_CREDENTIALS" }));
    expect(await signIn("individual", "elif@example.com", "yanlis")).toEqual({ ok: false, reason: "invalid" });
    vi.stubGlobal("fetch", answer(429, { code: "RATE_LIMITED" }));
    expect(await signIn("individual", "elif@example.com", "x")).toEqual({ ok: false, reason: "rate_limited" });
    vi.stubGlobal("fetch", answer(503));
    expect(await signIn("individual", "elif@example.com", "x")).toEqual({ ok: false, reason: "unavailable" });
    expect(written.has("novera_session")).toBe(false);
  });

  it("does not call a success without a session cookie a sign-in", async () => {
    const { signIn } = await import("../lib/auth-actions");
    vi.stubGlobal("fetch", answer(200, user));
    expect(await signIn("individual", "elif@example.com", "sifre-1234")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("signs up, and tells an address that is taken", async () => {
    const { signUp } = await import("../lib/auth-actions");
    const input = { firstName: "Elif", lastName: "Yıldız", email: "elif@example.com", password: "sifre-1234", consent: true };
    const fetchMock = answer(201, user, "novera_session=tok9; Path=/");
    vi.stubGlobal("fetch", fetchMock);
    expect(await signUp(input)).toEqual({ ok: true, locale: "en" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/auth/register");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "elif@example.com",
      password: "sifre-1234",
      firstName: "Elif",
      lastName: "Yıldız",
      consent: true,
    });
    vi.stubGlobal("fetch", answer(409, { code: "EMAIL_TAKEN" }));
    expect(await signUp(input)).toEqual({ ok: false, reason: "email_taken" });
  });

  it("signs out on the API and drops the cookie even when the API is down", async () => {
    const { signOut } = await import("../lib/auth-actions");
    sent.set("novera_session", "tok123");
    const fetchMock = answer(503);
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("http://api.test/auth/logout");
    expect(deleted).toContain("novera_session");
  });
});

describe("getSession", () => {
  beforeEach(() => {
    sent.clear();
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("USE_MOCKS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is nobody without a session cookie, and does not ask the API", async () => {
    const { getSession } = await import("../lib/session");
    const fetchMock = answer(200, user);
    vi.stubGlobal("fetch", fetchMock);
    expect(await getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the account from GET /me with the cookie, as an individual or a corporate account", async () => {
    sent.set("novera_session", "tok123");
    const { getSession } = await import("../lib/session");
    const fetchMock = answer(200, user);
    vi.stubGlobal("fetch", fetchMock);
    const session = await getSession();
    expect(session).toEqual({ type: "individual", user: { id: "u1", firstName: "Elif", lastName: "Yıldız", email: "elif@example.com" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/me");
    expect(init.headers).toMatchObject({ Cookie: "novera_session=tok123" });
  });

  it("is nobody when the API no longer knows the session", async () => {
    sent.set("novera_session", "old");
    vi.resetModules();
    const { getSession } = await import("../lib/session");
    vi.stubGlobal("fetch", answer(401, { code: "UNAUTHENTICATED" }));
    expect(await getSession()).toBeNull();
  });
});
