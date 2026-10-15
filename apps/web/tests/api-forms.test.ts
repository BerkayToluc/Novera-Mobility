import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactToApi, quoteToApi } from "../lib/api-forms";
import type { ContactInput } from "../lib/contact";
import type { QuoteInput } from "../lib/quote";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({ get: (name: string) => (name === "novera_session" ? { value: "abc" } : undefined) }),
}));

const quote: QuoteInput = {
  company: "Örnek A.Ş.",
  contactName: "Elif Kaya",
  phone: "+90 532 000 00 00",
  email: "elif@ornek.com",
  fleetSize: "21-50",
  term: "36+",
  needs: ["sedan", "suv"],
  cities: "İstanbul, Ankara",
  note: "Not",
  product: "vip-mobilite",
  consent: true,
  website: "",
} as QuoteInput;

const contact: ContactInput = {
  name: "Elif Kaya",
  email: "elif@ornek.com",
  phone: "",
  topic: "partnership",
  message: "Merhaba",
  consent: true,
  website: "",
} as ContactInput;

describe("form bodies for the API", () => {
  it("sends the lower end of the quote ranges", () => {
    const body = quoteToApi(quote);
    expect(body.vehicleCount).toBe(21);
    expect(body.durationMonths).toBe(36);
    expect(body.vehicleType).toBe("sedan,suv");
    expect(body.companyName).toBe("Örnek A.Ş.");
    expect(body.productSlug).toBe("vip-mobilite");
  });

  it("sends the topic's Turkish name as the subject", () => {
    const body = contactToApi(contact);
    expect(body.subject).toBe("İş birliği");
    expect(body.message).toBe("Merhaba");
  });
});

describe("apiPost", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const reply = (status: number, body: unknown = {}) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("is unavailable without API_URL", async () => {
    vi.stubEnv("API_URL", "");
    const { apiPost } = await import("../lib/api-post");
    expect(await apiPost("/contact", {})).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the visitor's address and session on", async () => {
    reply(201, { received: true });
    const { apiPost } = await import("../lib/api-post");
    const result = await apiPost("/quotes", { a: 1 });
    expect(result).toEqual({ status: "ok", data: { received: true } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/quotes");
    expect(init.headers["X-Forwarded-For"]).toBe("203.0.113.7");
    expect(init.headers.Cookie).toBe("novera_session=abc");
  });

  it("maps the error statuses", async () => {
    const { apiPost } = await import("../lib/api-post");
    reply(429);
    expect(await apiPost("/x", {})).toEqual({ status: "rate_limited" });
    reply(422, { code: "SPAM_DETECTED" });
    expect(await apiPost("/x", {})).toEqual({ status: "spam" });
    reply(422, { code: "VALIDATION_FAILED", fieldErrors: { email: "bad" } });
    expect(await apiPost("/x", {})).toEqual({ status: "invalid", fieldErrors: { email: "bad" } });
    reply(500);
    expect(await apiPost("/x", {})).toEqual({ status: "unavailable" });
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await apiPost("/x", {})).toEqual({ status: "unavailable" });
  });
});
