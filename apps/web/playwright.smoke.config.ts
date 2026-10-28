import { defineConfig, devices } from "@playwright/test";

// The smoke test against the real API (V2-19, QUALITY T-01): the built API and the built site, no sample data, a database that
// has been migrated and seeded. The main e2e (playwright.config.ts) runs with USE_MOCKS=1 and never touches the API code
// path; this walks the core of SPEC §6 item 1 through it: sign up, search, hold, summary, payment, confirmation, the
// booking in the account, cancel. 1280 px only.
//
// Locally: a database `novera_smoke` (`createdb`), then
//   DATABASE_URL=postgresql://…/novera_smoke pnpm --filter @novera/api exec prisma migrate deploy
//   DATABASE_URL=postgresql://…/novera_smoke pnpm --filter @novera/api db:seed
//   pnpm build   (both apps)   then   pnpm --filter @novera/web test:smoke
// `SMOKE_DATABASE_URL` points the API at another database. In CI this is its own step (.github/workflows/ci.yml).
const WEB_PORT = 3201;
const API_PORT = 3101;
const baseURL = `http://localhost:${WEB_PORT}`;
const apiURL = `http://localhost:${API_PORT}`;
// A key for this run only: it is what the site and the API share (ADR-14), so the header path is walked as in production.
const API_ACCESS_KEY = "smoke-run-access-key-0123456789abcdef";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "smoke-api",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
    },
  ],
  webServer: [
    {
      command: "node dist/main",
      cwd: "../api",
      url: `${apiURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? "postgresql://novera:novera@localhost:5432/novera_smoke",
        PORT: String(API_PORT),
        NODE_ENV: "development",
        API_ACCESS_KEY,
        WEB_URL: baseURL,
        TRUST_PROXY_HOPS: "1",
      },
    },
    {
      // No USE_MOCKS: the site reads from the API.
      command: `npx next start -p ${WEB_PORT}`,
      url: `${baseURL}/sitemap.xml`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: apiURL, API_ACCESS_KEY, NEXT_PUBLIC_SITE_URL: baseURL },
    },
  ],
});
