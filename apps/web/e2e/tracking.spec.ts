import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// The live tracking (V2-43, docs/FLEET.md §3, §3.1, ADR-30) on the sample of Ege Lojistik A.Ş., whose two cars (35 FLM 101, 35 FLM 102) are
// delivered to İzmir (mocks/tracking.ts). The positions move with the clock, so a test says what time it is with the `novera-mock-now` cookie
// (sample mode only, lib/mock-world.ts). The sample has no map key, so these tests are the screen with no map: the list says everything.
// That the simulation gives the same answer for the same input, and that another company's car is a 404, are covered by the API's tests.
const URL = "http://localhost:3200";
const FRIDAY_11 = Date.parse("2026-10-30T08:07:00.000Z"); // 11:07 in Istanbul, a working day
const FRIDAY_NIGHT = Date.parse("2026-10-30T19:30:00.000Z");
const SATURDAY = Date.parse("2026-10-31T09:00:00.000Z");

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: URL }]);
});

const setTime = (context: BrowserContext, at: number) => context.addCookies([{ name: "novera-mock-now", value: String(at), url: URL }]);

test("the cars are in a list with the ignition, the speed and who has them, under a Simülasyon badge, and the menu leads there", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await setTime(context, FRIDAY_11);
  await page.goto("/filom");
  await expect(page.locator('nav[aria-label="Filom bölümleri"] a', { hasText: "Canlı Takip" })).toHaveCount(1);
  await page.goto("/filom/canli-takip");
  await expect(page.getByRole("heading", { level: 1, name: "Canlı Takip" })).toBeVisible();
  await expect(page.getByText("Simülasyon", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Son güncelleme: 11:05")).toBeVisible();

  const table = page.getByRole("table", { name: "Araçlar" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("link", { name: "35 FLM 101 · Fiat Egea" })).toBeVisible();
  await expect(table.getByRole("link", { name: "35 FLM 102 · Togg T10X" })).toBeVisible();
  await expect(table.getByText("Kontak açık")).toHaveCount(2);
  // Without a key there is no map, and the screen says so; the list is the whole of it.
  await expect(page.getByText("Harita bu ortamda yok")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("at night and at the weekend the ignition is off, the speed is zero and the cars stand", async ({ page, context }) => {
  await signInSample(context, "corporate");
  for (const at of [FRIDAY_NIGHT, SATURDAY]) {
    await setTime(context, at);
    await page.goto("/filom/canli-takip");
    const table = page.getByRole("table", { name: "Araçlar" });
    await expect(table.getByText("Kontak kapalı")).toHaveCount(2);
    await expect(table.getByText("0 km/sa")).toHaveCount(2);
  }
});

test("choosing a car shows its route of the day, by the hour, and another of the last seven days can be chosen", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await setTime(context, FRIDAY_11);
  await page.goto("/filom/canli-takip");
  await page.getByRole("link", { name: "35 FLM 101 · Fiat Egea" }).click();
  await expect(page).toHaveURL(/arac=35FLM101/);
  await expect(page.getByRole("heading", { level: 2, name: "35 FLM 101 rotası" })).toBeVisible();
  const route = page.getByRole("table", { name: "35 FLM 101 rotası" });
  // Midnight to 11:00, today: twelve hours on the hour, and the row of headings.
  await expect(route.getByRole("row")).toHaveCount(13);
  await expect(page.getByText(/İzmir .*hattı: gün boyunca \d+ nokta/)).toBeVisible();

  const days = page.getByRole("navigation", { name: "Rota günü" });
  await expect(days.getByRole("link")).toHaveCount(7);
  await expect(days.getByRole("link", { name: "Bugün" })).toHaveAttribute("aria-current", "page");
  await days.getByRole("link").nth(1).click();
  await expect(page).toHaveURL(/gun=2026-10-29/);
  // A whole day: 24 hours and the row of headings.
  await expect(page.getByRole("table", { name: "35 FLM 101 rotası" }).getByRole("row")).toHaveCount(25);
});

test("a made-up address shows the list, not an error", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await setTime(context, FRIDAY_11);
  await page.goto("/filom/canli-takip?arac=00XXX000&gun=dün");
  await expect(page.getByRole("table", { name: "Araçlar" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /rotası/ })).toHaveCount(0);
  await page.goto("/filom/canli-takip?arac=35FLM101&gun=2026-11-30");
  await expect(page.getByRole("heading", { level: 2, name: "35 FLM 101 rotası" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Rota günü" }).getByRole("link", { name: "Bugün" })).toHaveAttribute("aria-current", "page");
});

test("the list renews itself every thirty seconds, and not while the tab is hidden", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await setTime(context, FRIDAY_11);
  await page.clock.install({ time: new Date(FRIDAY_11) });
  await page.goto("/filom/canli-takip");
  await expect(page.getByText("Son güncelleme: 11:05")).toBeVisible();
  const before = await page.getByRole("table", { name: "Araçlar" }).innerText();

  // Ten minutes later by the server's clock; thirty seconds on the page's.
  await setTime(context, FRIDAY_11 + 10 * 60_000);
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Son güncelleme: 11:15")).toBeVisible();
  expect(await page.getByRole("table", { name: "Araçlar" }).innerText()).not.toBe(before);

  // A hidden tab does not ask.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  });
  await setTime(context, FRIDAY_11 + 20 * 60_000);
  await page.clock.fastForward(60_000);
  await expect(page.getByText("Son güncelleme: 11:15")).toBeVisible();
  // Back in view: renewed at once, the answer being older than thirty seconds.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Son güncelleme: 11:25")).toBeVisible();
});

test("in English the screen speaks English, at phone width without a sideways page", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await setTime(context, FRIDAY_11);
  await page.goto("/en/my-fleet/live-tracking");
  await expect(page.getByRole("heading", { level: 1, name: "Live tracking" })).toBeVisible();
  await expect(page.getByText("Simulation", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Cars" }).getByText("Ignition on")).toHaveCount(2);
  await expect(page.getByText("km/h").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the screen is not there for who it is not for", async ({ page, context }) => {
  await signInSample(context, "individual");
  expect((await page.goto("/filom/canli-takip"))?.status()).toBe(404);
  await signInSample(context, "admin");
  expect((await page.goto("/filom/canli-takip"))?.status()).toBe(404);
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/canli-takip");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
