import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { RESULTS } from "./driver-helpers";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The campaign code screens (V2-26, docs/ADMIN.md §3.1) on the sample codes of mocks/promo-codes.ts. Both widths run at the
// same time against one server, so a code a test makes has a name of its own for each project.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

const nameFor = (project: string, kind: string) => "E2E" + (project === "mobile" ? "M" : "D") + kind;

async function makeCode(page: Page, code: string, percent: string, extra: Record<string, string> = {}) {
  await page.goto("/yonetim/kampanya-kodlari/yeni");
  await (await hydrated(page.getByLabel("Kod", { exact: true }))).fill(code);
  await page.getByLabel("İndirim yüzdesi").fill(percent);
  for (const [label, value] of Object.entries(extra)) await page.getByLabel(label).fill(value);
  await page.getByRole("button", { name: "Kodu oluştur" }).click();
  await expect(page).toHaveURL(/\/yonetim\/kampanya-kodlari$/);
}

async function goToSummary(page: Page) {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyon Özeti" })).toBeVisible();
}

async function applyOnSummary(page: Page, code: string) {
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill(code);
  await box.getByRole("button", { name: "Uygula" }).click();
  return box;
}

test("the list shows each code with its state in words, and narrows by state and by search", async ({ page }) => {
  await page.goto("/yonetim/kampanya-kodlari");
  await expect(page.getByRole("heading", { level: 1, name: "Kampanya kodları" })).toBeVisible();
  const table = page.getByRole("table", { name: /Kampanya kodları/ });
  await expect(table.getByRole("link", { name: "NOVERA10" })).toBeVisible();
  const row = (code: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name: code, exact: true }) });
  await expect(row("NOVERA10")).toContainText("Etkin");
  await expect(row("KIS24")).toContainText("Süresi doldu");
  await expect(row("KAPALI15")).toContainText("Kapalı");
  await expect(row("ILK5")).toContainText("Tavan doldu");
  await expect(row("ILK5")).toContainText("5 / 5");
  await expect(row("YAKINDA12")).toContainText("Başlamadı");

  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Süresi doldu" }).click();
  await expect(page).toHaveURL(/durum=EXPIRED/);
  await expect(table.getByRole("link", { name: "KIS24" })).toBeVisible();
  await expect(table.getByRole("link", { name: "NOVERA10" })).toHaveCount(0);

  // A search the filter cannot answer says so, and a way out is there.
  await page.goto("/yonetim/kampanya-kodlari?ara=ZZZZ");
  await expect(page.getByText("Bu aramaya uyan kod yok")).toBeVisible();
});

test("a code made in the panel takes its percentage off the booking summary, until it is switched off, and can then be deleted", async ({ page }, testInfo) => {
  const code = nameFor(testInfo.project.name, "20");
  await makeCode(page, code, "20");
  await expect(page.getByRole("status").filter({ hasText: "Kod oluşturuldu" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name: code })).toBeVisible();

  // The Clio for three days is ₺2.400; 20 percent is ₺480.
  await goToSummary(page);
  const box = await applyOnSummary(page, code);
  await expect(box.getByText(code + " uygulandı: %20 indirim.")).toBeVisible();
  await expect(page.getByText("−₺480")).toBeVisible();
  await expect(page.getByText("₺1.920").first()).toBeVisible();

  // Switched off, it is no longer taken.
  await page.goto("/yonetim/kampanya-kodlari/" + code);
  await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();
  await (await hydrated(page.getByRole("button", { name: "Kodu kapat" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(code + " kodu kapatılsın mı?");
  await dialog.getByRole("button", { name: "Kodu kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Kod kapatıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kodu aç" })).toBeVisible();

  await goToSummary(page);
  const closed = await applyOnSummary(page, code);
  await expect(closed.getByRole("alert")).toContainText("geçerli bir kampanya kodu değil");
  await expect(page.getByText(/Kampanya indirimi/)).toHaveCount(0);

  // It was never on a booking, so it can be deleted for good.
  await page.goto("/yonetim/kampanya-kodlari/" + code);
  await (await hydrated(page.getByRole("button", { name: "Kodu sil" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kodu sil" }).click();
  await expect(page).toHaveURL(/\/yonetim\/kampanya-kodlari$/);
  await expect(page.getByRole("table").getByRole("link", { name: code, exact: true })).toHaveCount(0);
  // A page that does not exist shows the not-found page. (The status stays 200 here: the panel's loading screen has already
  // started streaming when the page finds there is no such code; the panel is not indexed, so it costs nothing.)
  await page.goto("/yonetim/kampanya-kodlari/" + code);
  await expect(page.getByRole("heading", { level: 1, name: /bulunamadı|404|Sayfa/i })).toBeVisible();
});

test("a code that is on a booking is not deleted: the window says so and offers to switch it off", async ({ page }) => {
  await page.goto("/yonetim/kampanya-kodlari/NOVERA10");
  await (await hydrated(page.getByRole("button", { name: "Kodu sil" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kodu sil" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("NOVERA10 silinemez");
  await expect(dialog).toContainText("Silmek yerine kapatabilirsiniz");
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  // Nothing changed: it is still there and still on.
  await page.goto("/yonetim/kampanya-kodlari/NOVERA10");
  await expect(page.getByRole("button", { name: "Kodu kapat" })).toBeVisible();
});

test("a form with nothing in it, a name that is taken and a period backwards each say what is wrong on the field", async ({ page }) => {
  await page.goto("/yonetim/kampanya-kodlari/yeni");
  await (await hydrated(page.getByRole("button", { name: "Kodu oluştur" }))).click();
  await expect(page.getByText("3 ile 20 karakter arasında, yalnızca harf ve rakamdan oluşan bir kod yazın.")).toBeVisible();
  await expect(page.getByText("1 ile 90 arasında bir tam sayı yazın.")).toBeVisible();

  await page.getByLabel("Kod", { exact: true }).fill("NOVERA10");
  await page.getByLabel("İndirim yüzdesi").fill("10");
  await page.getByRole("button", { name: "Kodu oluştur" }).click();
  await expect(page.getByText("Bu adda bir kod zaten var.")).toBeVisible();

  await page.getByLabel("Kod", { exact: true }).fill("GERIYE1");
  await page.getByLabel("İlk geçerli gün").fill("2026-11-02");
  await page.getByLabel("Son geçerli gün").fill("2026-11-01");
  await page.getByRole("button", { name: "Kodu oluştur" }).click();
  await expect(page.getByText("Son gün, ilk günden önce olamaz.")).toBeVisible();
  await expect(page).toHaveURL(/\/yeni$/);
});

test("the limit cannot be lowered below the uses so far, and the form says how many there are", async ({ page }) => {
  await page.goto("/yonetim/kampanya-kodlari/NOVERA10");
  await (await hydrated(page.getByLabel("Toplam kullanım sınırı"))).fill("1");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Sınır, şimdiye kadarki kullanımdan (4) az olamaz.")).toBeVisible();
});

test("two people editing the same code: the second save is refused with a warning that keeps what they typed", async ({ page, context }, testInfo) => {
  // Two pages and a handful of hydrations: close to the default 30 seconds when the whole suite runs side by side.
  test.slow();
  const code = nameFor(testInfo.project.name, "ST");
  await makeCode(page, code, "10");

  const other = await context.newPage();
  await page.goto("/yonetim/kampanya-kodlari/" + code);
  await other.goto("/yonetim/kampanya-kodlari/" + code);
  await (await hydrated(other.getByLabel("İndirim yüzdesi"))).fill("15");
  await other.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" })).toBeVisible();

  await (await hydrated(page.getByLabel("İndirim yüzdesi"))).fill("30");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "Bu kayıt siz düzenlerken değişti" });
  await expect(warning).toBeVisible();
  await expect(page.getByLabel("İndirim yüzdesi")).toHaveValue("30");

  await warning.getByRole("button", { name: "Güncel kaydı yükle" }).click();
  await expect(page.getByLabel("İndirim yüzdesi")).toHaveValue("15");
  await other.close();
});

test("a day is chosen, and shown the same way after saving", async ({ page }, testInfo) => {
  const code = nameFor(testInfo.project.name, "DY");
  await makeCode(page, code, "12", { "İlk geçerli gün": "2026-11-01", "Son geçerli gün": "2026-11-30", "Toplam kullanım sınırı": "40" });
  const row = page.getByRole("table").getByRole("row").filter({ has: page.getByRole("link", { name: code, exact: true }) });
  await expect(row).toContainText("1 Kas 2026 – 30 Kas 2026");
  await expect(row).toContainText("0 / 40");
  await page.goto("/yonetim/kampanya-kodlari/" + code);
  await expect(page.getByLabel("İlk geçerli gün")).toHaveValue("2026-11-01");
  await expect(page.getByLabel("Son geçerli gün")).toHaveValue("2026-11-30");
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/promo-codes");
  await expect(page.getByRole("heading", { level: 1, name: "Campaign codes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New code" })).toBeVisible();
  await page.getByRole("link", { name: "New code" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/promo-codes\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "New campaign code" })).toBeVisible();
  await expect(page.getByLabel("Discount percentage")).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "individual");
  for (const path of ["/yonetim/kampanya-kodlari", "/yonetim/kampanya-kodlari/yeni", "/yonetim/kampanya-kodlari/NOVERA10"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("no horizontal scroll on the list or the form at this width", async ({ page }) => {
  for (const path of ["/yonetim/kampanya-kodlari", "/yonetim/kampanya-kodlari/yeni", "/yonetim/kampanya-kodlari/NOVERA10"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
