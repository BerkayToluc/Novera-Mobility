import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The invoices (V2-37, docs/ADMIN.md §3.15 and docs/FLEET.md §4) on the sample of Ege Lojistik A.Ş.: three invoices behind it, the oldest
// paid, the middle one late, the last one waiting (mocks/invoices.ts). A test that makes the invoices or marks one paid works in a world of
// its own (lib/mock-world.ts). That a month is made once, the lines add up to the kuruş and another company's invoice is a 404 against the
// real API and the database is covered by invoices.integration.spec.ts; here it is what the person sees and does.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

const thisMonth = new Intl.DateTimeFormat("tr", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date());

test("the administrator's list shows each invoice with its company and state, and narrows by state and word", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/yonetim/faturalar");
  await expect(page.getByRole("heading", { level: 1, name: "Faturalar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Faturalar" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row").filter({ hasText: "Ödendi" })).toHaveCount(1);
  await expect(table.getByRole("row").filter({ hasText: "Gecikti" })).toHaveCount(1);
  await expect(table.getByRole("row").filter({ hasText: "Bekliyor" })).toHaveCount(1);
  await expect(table.getByRole("row").nth(1)).toContainText("Ege Lojistik A.Ş.");

  await page.goto("/yonetim/faturalar?durum=OVERDUE");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/faturalar?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan fatura yok")).toBeVisible();
});

test("an invoice opens as a document with its lines, VAT and total, and says it is a sample", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/yonetim/faturalar");
  await page.getByRole("table", { name: "Faturalar" }).getByRole("link", { name: /^FTR-\d{4}-00002$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^FTR-\d{4}-00002$/ })).toBeVisible();

  const sheet = page.getByRole("article");
  await expect(sheet).toContainText("Ege Lojistik A.Ş.");
  await expect(sheet).toContainText("Gecikti");
  await expect(sheet.getByRole("table", { name: "Fatura satırları" })).toContainText("Akıllı Kurumsal Filo");
  await expect(sheet).toContainText("KDV (%20)");
  await expect(sheet).toContainText("Genel toplam");
  await expect(sheet).toContainText("Bu bir örnek faturadır, yasal belge (e-fatura) değildir.");

  // A page that does not exist shows the not-found page (the status stays 200: the panel's loading screen has already been sent).
  await page.goto("/yonetim/faturalar/FTR-2000-99999");
  await expect(page.getByRole("heading", { level: 1, name: /bulunamadı|404|Sayfa/i })).toBeVisible();
});

test("the invoices are made once a month, show on the customer's screen, and a paid mark changes the state there", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "olustur");
  await signInSample(context, "admin");
  await page.goto("/yonetim/faturalar");

  const generator = page.getByRole("region", { name: "Faturaları oluştur" });
  await expect(generator.getByLabel("Dönem")).toHaveValue(new Date().toISOString().slice(0, 7));
  await (await hydrated(generator.getByRole("button", { name: "Faturaları oluştur" }))).click();
  const dialog = page.getByRole("dialog", { name: `${thisMonth} faturaları oluşturulsun mu?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByRole("table", { name: "Faturalar" }).getByRole("row")).toHaveCount(4);

  await generator.getByRole("button", { name: "Faturaları oluştur" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Faturaları oluştur" }).click();
  await expect(page.getByText(`${thisMonth} için 1 fatura oluşturuldu.`)).toBeVisible();
  const table = page.getByRole("table", { name: "Faturalar" });
  await expect(table.getByRole("row")).toHaveCount(5);

  // The same month again is refused, and nothing is added.
  await generator.getByRole("button", { name: "Faturaları oluştur" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Faturaları oluştur" }).click();
  await expect(page.getByText(`${thisMonth} faturaları zaten oluşturulmuş.`)).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(5);

  // The new invoice is waiting; marking it paid is shown on the page, and taken back, too.
  await table.getByRole("link", { name: /^FTR-\d{4}-00004$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^FTR-\d{4}-00004$/ })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Bekliyor");
  await (await hydrated(page.getByRole("button", { name: "Ödendi olarak işaretle" }))).click();
  await expect(page.getByText(/FTR-\d{4}-00004 ödendi olarak işaretlendi\./)).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Ödendi");
  await expect(page.getByRole("button", { name: "Ödeme işaretini kaldır" })).toBeVisible();

  // The customer sees the new invoice, paid, and the summary no longer counts it among the unpaid.
  await signInSample(context, "corporate");
  await page.goto("/filom/faturalar");
  const fleetTable = page.getByRole("table", { name: "Faturalar" });
  await expect(fleetTable.getByRole("row")).toHaveCount(5);
  await expect(fleetTable.getByRole("row").filter({ hasText: thisMonth })).toContainText("Ödendi");
  await page.goto("/filom");
  await expect(page.locator("dt", { hasText: "Bu ayın faturası" }).locator("xpath=following-sibling::dd[2]")).toContainText("Ödendi");
  await expect(page.getByText("2 ödenmemiş fatura, 1 tanesi gecikmiş")).toBeVisible();
});

test("a stale screen does not overwrite an invoice that was marked in the meantime", async ({ page, context, browser }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "eskimis");
  await signInSample(context, "admin");
  await page.goto("/yonetim/faturalar/FTR-" + new Date().getUTCFullYear() + "-00002");
  const stale = await hydrated(page.getByRole("button", { name: "Ödendi olarak işaretle" }));

  // Someone else marks it from another screen of the same world.
  const other = await browser.newContext({ baseURL: "http://localhost:3200" });
  await other.addCookies((await context.cookies()).map((cookie) => ({ name: cookie.name, value: cookie.value, url: "http://localhost:3200" })));
  const otherPage = await other.newPage();
  await otherPage.goto("/yonetim/faturalar/FTR-" + new Date().getUTCFullYear() + "-00002");
  await (await hydrated(otherPage.getByRole("button", { name: "Ödendi olarak işaretle" }))).click();
  await expect(otherPage.getByRole("button", { name: "Ödeme işaretini kaldır" })).toBeVisible();
  await other.close();

  await stale.click();
  await expect(page.getByText("Fatura bu arada değişmiş; sayfa yenilendi, tekrar deneyin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ödeme işaretini kaldır" })).toBeVisible();
});

test("the customer's list shows only its own invoices, narrows by state, and opens one with its lines", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/faturalar");
  await expect(page.getByRole("heading", { level: 1, name: "Faturalar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Faturalar" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await page.goto("/filom/faturalar?durum=OVERDUE");
  await expect(table.getByRole("row")).toHaveCount(2);

  await table.getByRole("link", { name: /^FTR-\d{4}-00002$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^FTR-\d{4}-00002$/ })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Gecikti");
  await expect(page.getByRole("article")).toContainText("Bu bir örnek faturadır, yasal belge (e-fatura) değildir.");
  // The customer cannot mark it paid.
  await expect(page.getByRole("button", { name: /ödendi/i })).toHaveCount(0);

  expect((await page.goto("/filom/faturalar/FTR-2000-99999"))?.status()).toBe(404);
});

test("on paper only the invoice is left, on one page", async ({ page, context, browserName }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/faturalar/FTR-" + new Date().getUTCFullYear() + "-00002");
  await expect(page.getByRole("article")).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body > header")).toBeHidden();
  await expect(page.locator("body > footer")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Filom bölümleri" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Yazdır" })).toBeHidden();
  await expect(page.getByRole("article")).toBeVisible();

  if (browserName === "chromium") {
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  }
  await page.emulateMedia({ media: "screen" });
});

test("the summary says when this month's invoice is not made yet", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom");
  await expect(page.locator("dt", { hasText: "Bu ayın faturası" }).locator("xpath=following-sibling::dd[1]")).toHaveText("Henüz kesilmedi");
  await expect(page.getByText("2 ödenmemiş fatura, 1 tanesi gecikmiş")).toBeVisible();
  await page.getByRole("link", { name: /Faturaları aç.*Ödenmemiş fatura toplamı/ }).click();
  await expect(page).toHaveURL(/\/filom\/faturalar\?durum=OVERDUE/);
});

test("the screens are not there for who they are not for", async ({ page, context }) => {
  await signInSample(context, "individual");
  for (const path of ["/yonetim/faturalar", "/yonetim/faturalar/FTR-2026-00001", "/filom/faturalar", "/filom/faturalar/FTR-2026-00001"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
  await signInSample(context, "admin");
  for (const path of ["/filom/faturalar", "/filom/faturalar/FTR-2026-00001"]) expect((await page.goto(path))?.status(), path).toBe(404);
  // A corporate account with no fleet contract gets the empty state of Filom instead of the invoices.
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/faturalar");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Faturalar" })).toHaveCount(0);
});
