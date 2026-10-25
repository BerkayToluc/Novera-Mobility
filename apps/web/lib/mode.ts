// Where the data comes from: the API ("api") or the sample data in `mocks/` ("mock"). This is the only
// place that reads USE_MOCKS (ARCHITECTURE ADR-29, QUALITY G-06 and M-06); everything else asks dataMode().
//
// Rule: USE_MOCKS=1 means mock, anything else means api. With "api" and no API_URL the screens show their
// "service unavailable" state.
//
// The sample mode must never reach a real site: with it on, any credentials "sign in" and payment skips
// the real checks. So it cannot be switched on where the site is built or served for real.
export type DataMode = "api" | "mock";

// Set only by the test runs (CI, Playwright): they build and serve the production bundle with sample data.
// It is ignored on Vercel's production deployment.
const TEST_RUN_FLAG = "NOVERA_E2E";

// The reason the sample mode may not be on here, or null when it may be (or is not asked for at all).
export function mockModeProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!env.USE_MOCKS?.trim()) return null;
  if (env.VERCEL_ENV === "production") return "USE_MOCKS is set on a production deployment";
  if (env.NODE_ENV === "production" && env[TEST_RUN_FLAG] !== "1") return "USE_MOCKS is set in a production build";
  return null;
}

// Stops the build or the server, with a clear message, instead of serving sample data to real visitors.
export function assertMockModeAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const problem = mockModeProblem(env);
  if (problem) {
    throw new Error(`${problem}. Leave USE_MOCKS empty (it is for local work and tests only; see docs/ARCHITECTURE.md ADR-29).`);
  }
}

export function dataMode(env: NodeJS.ProcessEnv = process.env): DataMode {
  assertMockModeAllowed(env);
  return env.USE_MOCKS === "1" ? "mock" : "api";
}

export const isMockMode = (env: NodeJS.ProcessEnv = process.env): boolean => dataMode(env) === "mock";
