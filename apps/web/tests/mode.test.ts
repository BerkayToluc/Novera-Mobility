import { describe, expect, it } from "vitest";
import { assertMockModeAllowed, dataMode, isMockMode, mockModeProblem } from "../lib/mode";

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

// ADR-29, QUALITY G-06 / M-06: one place decides where the data comes from, and the sample mode cannot reach a real site.
describe("dataMode", () => {
  it("is mock only for USE_MOCKS=1", () => {
    expect(dataMode(env({ NODE_ENV: "development", USE_MOCKS: "1" }))).toBe("mock");
    expect(isMockMode(env({ NODE_ENV: "development", USE_MOCKS: "1" }))).toBe(true);
  });

  it.each([[{}], [{ USE_MOCKS: "" }], [{ USE_MOCKS: "0" }], [{ USE_MOCKS: "true" }]])("is api for %j", (values) => {
    expect(dataMode(env({ NODE_ENV: "development", ...values }))).toBe("api");
    expect(isMockMode(env({ NODE_ENV: "development", ...values }))).toBe(false);
  });
});

describe("where the sample mode may not be on", () => {
  it("is allowed in development and in tests", () => {
    expect(mockModeProblem(env({ NODE_ENV: "development", USE_MOCKS: "1" }))).toBeNull();
    expect(mockModeProblem(env({ NODE_ENV: "test", USE_MOCKS: "1" }))).toBeNull();
  });

  it("is refused in a production build", () => {
    expect(() => assertMockModeAllowed(env({ NODE_ENV: "production", USE_MOCKS: "1" }))).toThrow(/USE_MOCKS/);
    expect(() => dataMode(env({ NODE_ENV: "production", USE_MOCKS: "1" }))).toThrow(/production build/);
  });

  it("is refused for any non-empty value, not only 1", () => {
    expect(() => assertMockModeAllowed(env({ NODE_ENV: "production", USE_MOCKS: "0" }))).toThrow();
  });

  it("is refused on a Vercel production deployment", () => {
    expect(() => assertMockModeAllowed(env({ VERCEL_ENV: "production", NODE_ENV: "production", USE_MOCKS: "1" }))).toThrow(
      /production deployment/,
    );
  });

  it("the test-run flag lets CI serve the production bundle with sample data, but never on Vercel production", () => {
    expect(mockModeProblem(env({ NODE_ENV: "production", USE_MOCKS: "1", NOVERA_E2E: "1" }))).toBeNull();
    expect(mockModeProblem(env({ VERCEL_ENV: "production", NODE_ENV: "production", USE_MOCKS: "1", NOVERA_E2E: "1" }))).not.toBeNull();
  });

  it("does nothing when the sample mode is not asked for", () => {
    expect(() => assertMockModeAllowed(env({ NODE_ENV: "production" }))).not.toThrow();
    expect(() => assertMockModeAllowed(env({ NODE_ENV: "production", USE_MOCKS: " " }))).not.toThrow();
    expect(dataMode(env({ NODE_ENV: "production" }))).toBe("api");
  });
});
