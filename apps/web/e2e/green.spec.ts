import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The Green Fleet (V2-40, docs/FLEET.md §3, §3.1, ADR-30) on the sample of Ege Lojistik A.Ş., whose contract has one electric car, the Togg
// T10X "35 FLM 102" (the petrol Egea "35 FLM 101" is not in it): its readings (mocks/admin-contracts.ts) and five made-up stations
// in İzmir, whose state moves every five minutes (mocks/green.ts). That the simulation gives the same answer for the same car and the same
// five minutes, and that the carbon is the kilometres times the factors, are covered by the API's tests; here it is what the person sees.
// The company in the issue, Yeşil Enerji Ltd., is the seed's, which the sample mode does not have; its case is fleet-green.integration.spec.ts.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

test("the Green Fleet is in the menu of a company with an electric car and shows its carbon, charge and battery", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom");
  // The menu is a closed list at phone width, so the links are looked for in the markup, not in what is on show.
  await expect(page.locator('nav[aria-label="Filom bölümleri"] a', { hasText: "Yeşil Filo" })).toHaveCount(1);
  await page.goto("/filom/yesil-filo");
  await expect(page.getByRole("heading", { level: 1, name: "Yeşil Filo" })).toBeVisible();

  // The carbon says it is an example, and says how it is worked out.
  const carbon = page.getByRole("region", { name: "Karbon tasarrufu", exact: true });
  await expect(carbon.getByText("Örnek hesap")).toBeVisible();
  await expect(carbon).toContainText("170 g CO₂/km");
  await expect(carbon).toContainText("elektrikli 45 g");
  await expect(carbon.getByRole("table", { name: "Karbon tasarrufu" })).toContainText("35 FLM 102");
  await expect(carbon.getByRole("table", { name: "Karbon tasarrufu" })).not.toContainText("35 FLM 101");

  const charge = page.getByRole("table", { name: "Şarj seviyesi" });
  await expect(charge).toContainText("35 FLM 102");
  await expect(charge).toContainText("%64");

  // The battery's health: a chart that is a picture, and under it the table that is read.
  const battery = page.getByRole("figure").filter({ has: page.getByText("Son 6 ayda batarya sağlığı", { exact: true }) });
  await expect(battery.locator("svg").first()).toBeVisible();
  await expect(battery.getByRole("table", { name: "Son 6 ayda batarya sağlığı" })).toContainText("%98");
});

test("the nearest charging stations are listed with a distance and a state, and everything about them says Simülasyon", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/yesil-filo");
  const stations = page.getByRole("region", { name: "Yakındaki şarj istasyonları", exact: true });
  await expect(stations.getByText("Simülasyon", { exact: true })).toBeVisible();
  const table = stations.getByRole("table", { name: "Yakındaki şarj istasyonları" });
  await expect(table.getByRole("row")).toHaveCount(1 + 5);
  await expect(table.getByRole("row").nth(1)).toContainText("İzmir");
  await expect(table.getByRole("row").nth(1)).toContainText(/ km/);
  // Every state is written as a word (the colour is not the only thing).
  for (const row of (await table.getByRole("row").all()).slice(1)) await expect(row).toContainText(/Müsait|Dolu|Arızalı/);
  await expect(stations).toContainText("gerçek bir istasyon ağına bağlı değildir");
  await expect(stations.getByRole("navigation", { name: "Araç" }).getByRole("link", { name: "35 FLM 102" })).toHaveAttribute("aria-current", "page");
});

test("the period of the carbon is chosen, and a made-up address shows the default", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/yesil-filo");
  const nav = page.getByRole("navigation", { name: "Dönem" });
  await expect(nav.getByRole("link", { name: "Son 3 ay" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Bu yıl" }).click();
  await expect(page).toHaveURL(/donem=bu-yil/);
  await hydrated(nav.getByRole("link", { name: "Özel dönem" }));
  await page.goto("/filom/yesil-filo?donem=ozel&bas=bu&bit=ay&arac=yok");
  await expect(nav.getByRole("link", { name: "Son 3 ay" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table", { name: "Yakındaki şarj istasyonları" })).toBeVisible();
});

test("a company whose electric car is given back has no Green Fleet in the menu, and the address says so", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "iade");
  await signInSample(context, "admin");
  await page.goto("/yonetim/sirketler/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01");
  await page.getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  const cars = page.getByRole("region", { name: "Araçlar" });
  await (await hydrated(cars.getByRole("button", { name: "İade et: 35 FLM 102" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aracı iade et" }).click();
  await expect(cars.getByRole("listitem").filter({ hasText: "35 FLM 102" })).toContainText("İade edildi");

  await signInSample(context, "corporate");
  await page.goto("/filom");
  await expect(page.locator('nav[aria-label="Filom bölümleri"] a', { hasText: "Yeşil Filo" })).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Filom bölümleri"] a', { hasText: "Raporlar" })).toHaveCount(1);
  await page.goto("/filom/yesil-filo");
  await expect(page.getByText("Yeşil Filo'da araç yok")).toBeVisible();
  await expect(page.getByRole("link", { name: "Araçlarınızı görün" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("in English the Green Fleet speaks English, at phone width without a sideways page", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/en/my-fleet/green-fleet");
  await expect(page.getByRole("heading", { level: 1, name: "Green Fleet" })).toBeVisible();
  await expect(page.getByText("Example calculation", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Charging stations nearby" })).toBeVisible();
  await expect(page.getByText("Simulation", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the screen is not there for who it is not for", async ({ page, context }) => {
  await signInSample(context, "individual");
  expect((await page.goto("/filom/yesil-filo"))?.status()).toBe(404);
  await signInSample(context, "admin");
  expect((await page.goto("/filom/yesil-filo"))?.status()).toBe(404);
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/yesil-filo");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
