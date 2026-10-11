import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (ARCHITECTURE ADR-11, SPEC §8): the built site, started with sample data, driven
// in a real browser at phone width (375 px) and desktop width (1280 px). Build first (`pnpm build`),
// then `pnpm test:e2e`. The port is its own, so a development server on 3000 is left alone.
const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    // The system's Chrome is used when it is there, so no browser has to be downloaded; without it
    // (CI), set PLAYWRIGHT_CHANNEL= to use the one `playwright install chromium` fetches.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/sitemap.xml`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { USE_MOCKS: "1", NEXT_PUBLIC_SITE_URL: baseURL, ANALYTICS_SCRIPT_URL: "https://analytics.example/script.js", ANALYTICS_WEBSITE_ID: "e2e" },
  },
});
