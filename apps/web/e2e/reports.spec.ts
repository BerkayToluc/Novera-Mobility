import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// The report (V2-39, docs/FLEET.md §3, §3.1) on the sample of Ege Lojistik A.Ş.: three invoices and nine expenses behind it, two cars, two
// departments' worth of people (mocks/reports.ts builds it by the API's rules). That the totals are the invoices and expenses to the kuruş,
// against the real API and the database, is covered by fleet-reports.integration.spec.ts; here it is what the person sees and reads.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

test("the report shows the totals and, under every chart, a table of the same data", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/raporlar");
  await expect(page.getByRole("heading", { level: 1, name: "Raporlar" })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Toplam maliyet" })).toBeVisible();
  await expect(page.getByText("Aynı veri aşağıdaki tabloda.").first()).toBeVisible();

  for (const name of ["Aylara göre maliyet", "Aylara göre kilometre", "Araçlara göre maliyet", "Departmanlara göre maliyet"]) {
    const figure = page.getByRole("figure").filter({ has: page.getByText(name, { exact: true }) });
    await expect(figure.getByRole("table", { name })).toBeVisible();
  }
  // The months table has the three months of the default period and the row of sums; the vehicles table lists both cars.
  const months = page.getByRole("table", { name: "Aylara göre maliyet" });
  await expect(months.getByRole("row")).toHaveCount(1 + 3 + 1);
  await expect(page.getByRole("table", { name: "Araçlara göre maliyet" }).getByRole("row").filter({ hasText: "35 FLM 101" })).toHaveCount(1);
  await expect(page.getByRole("table", { name: "Departmanlara göre maliyet" }).getByRole("row").filter({ hasText: "Satış" })).toHaveCount(1);
  await expect(page.getByRole("table", { name: "Departmanlara göre maliyet" }).getByRole("row").filter({ hasText: "Atanmamış / departmansız" })).toHaveCount(1);
});

test("the chart is a picture hidden from screen readers; the table is what is read, and it can be reached by keyboard", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/raporlar");
  const figure = page.getByRole("figure").first();
  await expect(figure.locator("svg").first()).toBeVisible();
  expect(await figure.locator("ol[aria-hidden='true']").count()).toBe(1);
  const region = figure.getByRole("region", { name: /yatay kaydırılabilir/ });
  await region.focus();
  await expect(region).toBeFocused();
});

test("the period is chosen from the four choices, and a custom run goes in the address", async ({ page, context }) => {
  await signInSample(context, "corporate");
  // The sample's invoices and expenses are of August to October 2026, so "this month" is October 2026 whatever day the test runs on: it is
  // said what time it is (sample mode, lib/mock-world.ts). It broke on 1 November 2026, when the real "this month" had nothing in it.
  await context.addCookies([{ name: "novera-mock-now", value: String(Date.parse("2026-10-31T09:00:00.000Z")), url: "http://localhost:3200" }]);
  await page.goto("/filom/raporlar");
  const nav = page.getByRole("navigation", { name: "Dönem" });
  await expect(nav.getByRole("link", { name: "Son 3 ay" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Bu ay" }).click();
  await expect(page).toHaveURL(/donem=bu-ay/);
  await expect(page.getByRole("table", { name: "Aylara göre maliyet" }).getByRole("row")).toHaveCount(1 + 1 + 1);

  await nav.getByRole("link", { name: "Bu yıl" }).click();
  await expect(page).toHaveURL(/donem=bu-yil/);

  const year = 2026;
  await page.goto(`/filom/raporlar?donem=ozel&bas=${year}-01&bit=${year}-02`);
  await expect(page.getByLabel("İlk ay")).toHaveValue(`${year}-01`);
  await expect(page.getByLabel("Son ay")).toHaveValue(`${year}-02`);
  // Nothing in those months: a meaningful empty state, with a way out.
  await expect(page.getByText("Bu dönemde veri yok")).toBeVisible();
  await page.getByRole("link", { name: "Bu yılı göster" }).click();
  await expect(page).toHaveURL(/donem=bu-yil/);

  // A made-up address shows the default report, not an error.
  await page.goto("/filom/raporlar?donem=ozel&bas=bu&bit=ay");
  await expect(nav.getByRole("link", { name: "Özel dönem" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table", { name: "Aylara göre maliyet" })).toBeVisible();
});

test("in English the report speaks English, at phone width without a sideways page", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/en/my-fleet/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Cost by vehicle" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Last 3 months" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the report is not there for who it is not for", async ({ page, context }) => {
  await signInSample(context, "individual");
  expect((await page.goto("/filom/raporlar"))?.status()).toBe(404);
  await signInSample(context, "admin");
  expect((await page.goto("/filom/raporlar"))?.status()).toBe(404);
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/raporlar");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Aylara göre maliyet" })).toHaveCount(0);
});
