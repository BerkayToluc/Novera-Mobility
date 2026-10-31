import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The contract and fleet car screens (V2-35, docs/ADMIN.md §3.12) on the sample contract of Ege Lojistik A.Ş. (two cars, one with a
// person) and the companies that have none. A test that adds or changes something works in a world of its own (lib/mock-world.ts). That
// the same rules hold against the real API and the database (the plate is one car, the kilometre does not go back, a contract with cars
// is not ended) is covered by contracts.integration.spec.ts; here it is what the person sees and does.
const EGE = "/yonetim/sirketler/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const ANADOLU = "/yonetim/sirketler/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

const openSampleContract = async (page: Page) => {
  await page.goto(EGE);
  await page.getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^SZL-\d{4}-00001$/ })).toBeVisible();
};

test("the company page lists its contract, and the contract page shows its facts and its cars", async ({ page }) => {
  await page.goto(EGE);
  const section = page.getByRole("region", { name: "Sözleşmeler" });
  await expect(section).toContainText("Akıllı Kurumsal Filo");
  await expect(section).toContainText("İzmir");
  await expect(section).toContainText("2 araç");
  await expect(section).toContainText("Etkin");

  await section.getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^SZL-\d{4}-00001$/ })).toBeVisible();
  const facts = page.getByRole("region", { name: "Sözleşme bilgileri" });
  await expect(facts).toContainText("Ege Lojistik A.Ş.");
  await expect(facts).toContainText("₺64.000,00");
  await expect(facts).toContainText("İzmir");

  const cars = page.getByRole("region", { name: "Araçlar" });
  const egea = cars.getByRole("listitem").filter({ hasText: "35 FLM 101" });
  await expect(egea).toContainText("Fiat Egea");
  await expect(egea).toContainText("Ayşe Demir");
  await expect(egea).toContainText("20.100 km");
  await expect(cars.getByRole("listitem").filter({ hasText: "35 FLM 102" })).toContainText("Boşta");
});

test("a company with no contract says so, and a contract is made for it", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "yeni");
  await page.goto(ANADOLU);
  await expect(page.getByText("Bu şirketin henüz sözleşmesi yok.")).toBeVisible();

  const form = page.getByRole("form", { name: "Yeni sözleşme" });
  await (await hydrated(form.getByRole("button", { name: "Sözleşmeyi oluştur" }))).click();
  await expect(form.getByText("Geçerli bir başlangıç günü seçin.")).toBeVisible();
  await expect(form.getByText("Listeden bir şehir seçin.")).toBeVisible();

  await form.getByLabel("Teslim şehri").selectOption("Ankara");
  await form.getByLabel("Başlangıç günü").fill("2026-11-01");
  await form.getByLabel("Bitiş günü").fill("2026-10-01");
  await form.getByLabel("Aylık bedel (₺)").fill("45.000");
  await form.getByRole("button", { name: "Sözleşmeyi oluştur" }).click();
  await expect(form.getByText("Bitiş günü, başlangıç gününden sonra olmalı.")).toBeVisible();
  await expect(form.getByText("Aylık bedeli liraya yazın")).toBeVisible();

  await form.getByLabel("Bitiş günü").fill("2027-10-31");
  await form.getByLabel("Aylık bedel (₺)").fill("45000");
  await form.getByLabel("Ürün").selectOption("yesil-filo");
  await form.getByRole("button", { name: "Sözleşmeyi oluştur" }).click();

  await expect(page.getByRole("heading", { level: 1, name: /^SZL-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sözleşme bilgileri" })).toContainText("Yeşil Filo");
  await expect(page.getByRole("region", { name: "Sözleşme bilgileri" })).toContainText("₺45.000,00");
  await expect(page.getByText("Bu sözleşmeye henüz araç eklenmedi.")).toBeVisible();
});

test("a car is added, its plate is one car, and a reading is entered that does not go back", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "arac");
  await openSampleContract(page);

  const form = page.getByRole("form", { name: "Araç ekle" });
  await (await hydrated(form.getByRole("button", { name: "Aracı ekle" }))).click();
  await expect(form.getByText("Listeden bir model seçin.")).toBeVisible();
  await expect(form.getByText("Geçerli bir plaka yazın")).toBeVisible();

  // The plate of a car that is in the fleet already, typed another way.
  await form.getByLabel("Model", { exact: true }).selectOption({ index: 1 });
  await form.getByLabel("Plaka").fill("35flm101");
  await form.getByLabel("Model yılı").fill("2025");
  await form.getByLabel("Başlangıç kilometresi").fill("500");
  await form.getByRole("button", { name: "Aracı ekle" }).click();
  await expect(form.getByText("Bu plakayla başka bir araç var (kiralık ya da filo).")).toBeVisible();

  await form.getByLabel("Plaka").fill("06 tst 901");
  await form.getByRole("button", { name: "Aracı ekle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç eklendi" })).toBeVisible();
  const added = page.getByRole("region", { name: "Araçlar" }).getByRole("listitem").filter({ hasText: "06 TST 901" });
  await expect(added).toContainText("500 km");

  const reading = page.getByRole("form", { name: "Okuma gir" });
  await reading.getByLabel("Araç", { exact: true }).selectOption({ label: "35 FLM 101 · Fiat Egea" });
  await reading.getByLabel("Kilometre", { exact: true }).fill("20000");
  await reading.getByRole("button", { name: "Okumayı kaydet" }).click();
  await expect(reading.getByText("Kilometre, son okumadan (20100) küçük olamaz.")).toBeVisible();

  await reading.getByLabel("Kilometre", { exact: true }).fill("20750");
  await reading.getByLabel("Yakıt (%)").fill("45");
  await reading.getByRole("button", { name: "Okumayı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Okuma kaydedildi" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Araçlar" }).getByRole("listitem").filter({ hasText: "35 FLM 101" })).toContainText("20.750 km");
});

test("giving a car back asks first, and a contract with cars is ended only after they are all back", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "iade");
  await openSampleContract(page);
  const cars = page.getByRole("region", { name: "Araçlar" });

  // The contract cannot be ended while a car is with the company.
  await page.getByLabel("Durum").selectOption("ENDED");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Bu sözleşmenin 2 aracı hâlâ şirketin yanında.")).toBeVisible();

  await (await hydrated(cars.getByRole("button", { name: "İade et: 35 FLM 101" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("35 FLM 101 iade edilsin mi?");
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(cars.getByRole("listitem").filter({ hasText: "35 FLM 101" })).not.toContainText("İade edildi");

  for (const plate of ["35 FLM 101", "35 FLM 102"]) {
    await cars.getByRole("button", { name: `İade et: ${plate}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Aracı iade et" }).click();
    await expect(cars.getByRole("listitem").filter({ hasText: plate })).toContainText("İade edildi");
  }
  // A car that is given back is history: no button, and no reading is taken for it.
  await expect(cars.getByRole("button", { name: /İade et/ })).toHaveCount(0);
  await expect(page.getByText("Okuma girilecek kullanımda araç yok.")).toBeVisible();

  await page.getByLabel("Durum").selectOption("ENDED");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sözleşme bilgileri" })).toContainText("Bitti");
  await expect(page.getByText("Sözleşme bitmiş; araç eklenemez.")).toBeVisible();
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/companies/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01");
  await expect(page.getByRole("region", { name: "Contracts" })).toContainText("Smart Corporate Fleet");
  await page.getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  await expect(page).toHaveURL(/\/en\/admin\/companies\/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01\/contracts\/SZL-\d{4}-00001$/);
  await expect(page.getByRole("region", { name: "Cars" })).toContainText("35 FLM 101");
  await expect(page.getByRole("form", { name: "Enter a reading" })).toBeVisible();
});
