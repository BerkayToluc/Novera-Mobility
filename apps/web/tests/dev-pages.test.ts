import { describe, expect, it } from "vitest";
import { devPagesOpen } from "../lib/dev-pages";

describe("devPagesOpen", () => {
  it("is open in development and test runs, never on a real site", () => {
    expect(devPagesOpen({ NODE_ENV: "development" })).toBe(true);
    expect(devPagesOpen({ NODE_ENV: "production", NOVERA_E2E: "1" })).toBe(true);
    expect(devPagesOpen({ NODE_ENV: "production" })).toBe(false);
    expect(devPagesOpen({ NODE_ENV: "production", NOVERA_E2E: "0" })).toBe(false);
    // The test flag does not count on Vercel's production deployment.
    expect(devPagesOpen({ NODE_ENV: "production", NOVERA_E2E: "1", VERCEL_ENV: "production" })).toBe(false);
  });
});
