import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, parseConsent, serializeConsent } from "@/lib/consent";
import { parseCurrency } from "@/lib/currency";
import { parsePreferences } from "@/lib/preferences";
import { colorSchemeOf, parseTheme } from "@/lib/theme";

describe("cookie consent", () => {
  it("reads what it wrote", () => {
    expect(parseConsent(serializeConsent(true))).toEqual({ v: CONSENT_VERSION, analytics: true });
    expect(parseConsent(serializeConsent(false))).toEqual({ v: CONSENT_VERSION, analytics: false });
  });

  it("reads an unencoded value too", () => {
    expect(parseConsent('{"v":1,"analytics":true}')).toEqual({ v: 1, analytics: true });
  });

  it("treats a missing, broken or old answer as no answer", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("not json")).toBeNull();
    expect(parseConsent('{"v":0,"analytics":true}')).toBeNull();
    expect(parseConsent('{"v":1,"analytics":"yes"}')).toBeNull();
  });
});

describe("account preferences", () => {
  it("reads a saved choice", () => {
    expect(parsePreferences('{"currency":"EUR","locale":"en","theme":"dark"}')).toEqual({
      currency: "EUR",
      locale: "en",
      theme: "dark",
    });
  });

  it("falls back field by field, so a tampered value never gets through", () => {
    expect(parsePreferences('{"currency":"<script>","locale":"de","theme":"neon"}')).toEqual({
      currency: "TRY",
      locale: "tr",
      theme: "light",
    });
  });

  it("is null when there is nothing usable", () => {
    expect(parsePreferences(undefined)).toBeNull();
    expect(parsePreferences("{")).toBeNull();
  });
});

describe("currency and theme", () => {
  it("fall back to the defaults", () => {
    expect(parseCurrency("GBP")).toBe("TRY");
    expect(parseCurrency(undefined)).toBe("TRY");
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseTheme("blue")).toBe("light");
    expect(parseTheme("system")).toBe("system");
  });

  it("tells the browser both schemes for the system theme", () => {
    expect(colorSchemeOf("system")).toBe("light dark");
    expect(colorSchemeOf("dark")).toBe("dark");
  });
});
