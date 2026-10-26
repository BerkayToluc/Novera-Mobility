import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "../lib/account-actions";
import { sessionFromApi } from "../lib/api-mappers";
import type { components } from "../lib/api-types";
import { signInWithGoogle } from "../lib/auth-actions";
import { buildCsp } from "../lib/csp";
import { MOCK_GOOGLE_COOKIE, MOCK_SESSION_COOKIE } from "../lib/session";

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

type User = components["schemas"]["User"];
const user = {
  id: "u1",
  email: "ece@example.com",
  firstName: "Ece",
  lastName: "Aydın",
  accountType: "INDIVIDUAL",
  companyName: null,
  locale: "en",
  theme: "dark",
  currency: "EUR",
  hasPassword: false,
  googleLinked: true,
} as unknown as User;

const answer = (status: number, body?: unknown, setCookie?: string) =>
  vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers: setCookie ? [["set-cookie", setCookie]] : [] }),
  );

beforeEach(() => {
  sent.clear();
  written.clear();
  deleted.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Google sign-in against the API", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("USE_MOCKS", "");
  });

  it("sends the credential, keeps the session cookie and applies the account's preferences", async () => {
    const fetchMock = answer(200, user, "novera_session=tok9; Path=/; Expires=Wed, 11 Nov 2026 10:00:00 GMT; HttpOnly");
    vi.stubGlobal("fetch", fetchMock);
    expect(await signInWithGoogle("id-token")).toEqual({ ok: true, locale: "en" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/auth/google");
    expect(JSON.parse(init.body as string)).toEqual({ credential: "id-token" });
    expect(written.get("novera_session")?.value).toBe("tok9");
    expect(written.get("novera-theme")?.value).toBe("dark");
  });

  it("asks for the consent of a new account, and sends the same credential again with it", async () => {
    vi.stubGlobal("fetch", answer(422, { code: "VALIDATION_FAILED", fieldErrors: { consent: "CONSENT_REQUIRED" } }));
    expect(await signInWithGoogle("id-token")).toEqual({ ok: false, reason: "consent_required" });
    expect(written.has("novera_session")).toBe(false);

    const fetchMock = answer(201, user, "novera_session=tok1; Path=/");
    vi.stubGlobal("fetch", fetchMock);
    expect(await signInWithGoogle("id-token", true)).toEqual({ ok: true, locale: "en" });
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      credential: "id-token",
      consent: true,
    });
  });

  it.each([
    [403, { code: "GOOGLE_NOT_ALLOWED" }, "not_allowed"],
    [401, { code: "GOOGLE_TOKEN_INVALID" }, "invalid_token"],
    [429, { code: "RATE_LIMITED" }, "rate_limited"],
    [503, { code: "GOOGLE_SIGNIN_UNAVAILABLE" }, "not_configured"],
    [503, undefined, "unavailable"],
    [500, { code: "INTERNAL" }, "unavailable"],
  ])("tells a %i answer apart (%j)", async (status, body, reason) => {
    vi.stubGlobal("fetch", answer(status as number, body));
    expect(await signInWithGoogle("id-token")).toMatchObject({ ok: false, reason });
    expect(written.has("novera_session")).toBe(false);
  });

  it("does not call a success without a session cookie a sign-in", async () => {
    vi.stubGlobal("fetch", answer(200, user));
    expect(await signInWithGoogle("id-token")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("refuses an empty credential without calling the API", async () => {
    const fetchMock = answer(200, user);
    vi.stubGlobal("fetch", fetchMock);
    expect(await signInWithGoogle("")).toEqual({ ok: false, reason: "invalid_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Google sign-in with the sample data", () => {
  beforeEach(() => vi.stubEnv("USE_MOCKS", "1"));

  it("signs the sample account in", async () => {
    expect(await signInWithGoogle("sample-credential")).toEqual({ ok: true, locale: null });
    expect(written.get(MOCK_SESSION_COOKIE)?.value).toBe("individual");
  });

  it("opens a sample account without a password only after the consent", async () => {
    sent.set(MOCK_GOOGLE_COOKIE, "new");
    expect(await signInWithGoogle("sample-credential")).toEqual({ ok: false, reason: "consent_required" });
    expect(await signInWithGoogle("sample-credential", true)).toEqual({ ok: true, locale: null });
    expect(written.get(MOCK_SESSION_COOKIE)?.value).toBe("google");
    expect(deleted).toContain(MOCK_GOOGLE_COOKIE);
  });

  it.each([
    ["corporate", "not_allowed"],
    ["invalid", "invalid_token"],
    ["limit", "rate_limited"],
    ["down", "not_configured"],
  ])("plays the %s refusal", async (hook, reason) => {
    sent.set(MOCK_GOOGLE_COOKIE, hook);
    expect(await signInWithGoogle("sample-credential")).toMatchObject({ ok: false, reason });
  });
});

describe("an account without a password", () => {
  it("is read from /me", () => {
    expect(sessionFromApi(user)).toMatchObject({ type: "individual", hasPassword: false, googleLinked: true });
  });

  it("is told so when it tries to change one", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("USE_MOCKS", "");
    sent.set("novera_session", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) =>
        url.endsWith("/me") && init.method === "GET"
          ? new Response(JSON.stringify(user))
          : new Response(JSON.stringify({ code: "PASSWORD_NOT_SET" }), { status: 409 }),
      ),
    );
    expect(await changePassword("whatever-1", "new-password-1")).toEqual({ ok: false, reason: "no_password" });
  });
});

describe("the Content-Security-Policy", () => {
  it("lets Google's sign-in button load, frame, call out and style itself", () => {
    const policy = Object.fromEntries(
      buildCsp("abc")
        .split("; ")
        .map((part) => [part.split(" ")[0], part]),
    );
    expect(policy["script-src"]).toContain("https://accounts.google.com/gsi/client");
    expect(policy["frame-src"]).toContain("https://accounts.google.com");
    expect(policy["connect-src"]).toContain("https://accounts.google.com");
    expect(policy["style-src"]).toContain("https://accounts.google.com/gsi/style");
  });
});
