import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The vehicle model screens (V2-29, docs/ADMIN.md §3.1) on the sample models of mocks/models.ts. Both widths run side by side
// against one server, and other specs count the models on the site, so a test that changes models works in a world of its own
// (the cookie of lib/mock-world.ts); the tests that only read use the shared one, which nobody changes.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  const world = `e2e-${testInfo.project.name}-${word}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

const modelFor = (testInfo: TestInfo, word: string) => `${word} ${testInfo.project.name === "mobile" ? "M" : "D"}`;

async function fillModel(page: Page, model: string) {
  await (await hydrated(page.getByLabel("Marka"))).fill("Deneme");
  await page.getByLabel("Model adı").fill(model);
  await page.getByLabel("Sınıf", { exact: true }).selectOption("economy");
  await page.getByLabel("Tüketim (litre / 100 km)").fill("5,2");
  await page.getByLabel("Günlük fiyat (₺)").fill("1250,50");
  await page.getByLabel("Açıklama (Türkçe)").fill("Şehir içi için küçük ve ekonomik bir deneme aracı.");
  await page.getByLabel("Açıklama (İngilizce)").fill("A small and economical test car for the city.");
}

test("the list shows each model with its class, fuel, price and state, and narrows by state, fuel and search", async ({ page }) => {
  await page.goto("/yonetim/modeller");
  await expect(page.getByRole("heading", { level: 1, name: "Araç modelleri" })).toBeVisible();
  const table = page.getByRole("table", { name: "Araç modelleri" });
  const row = (name: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });
  await expect(row("Fiat Egea")).toContainText("Dizel");
  await expect(row("Fiat Egea")).toContainText("Yayında");
  await expect(row("Fiat Egea")).toContainText("850");

  // The state: none of the sample models is retired.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Kaldırılmış" }).click();
  await expect(page).toHaveURL(/durum=RETIRED/);
  await expect(page.getByText("Bu aramaya uyan model yok")).toBeVisible();

  // The fuel, and a word typed without the Turkish letters.
  await page.goto("/yonetim/modeller");
  await page.getByRole("navigation", { name: "Yakıta göre" }).getByRole("link", { name: "Elektrik" }).click();
  await expect(page).toHaveURL(/yakit=ELECTRIC/);
  await expect(table.getByRole("link", { name: "Fiat Egea", exact: true })).toHaveCount(0);
  await page.goto("/yonetim/modeller?ara=volkswagen");
  await expect(table.getByRole("link", { name: "Volkswagen Passat", exact: true })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(2);
});

test("a new model is on the fleet page at once; retired it is on none of it; restored it is back", async ({ page, context }, testInfo) => {
  // It walks the panel and the home page, twice: more than the default 30 seconds when the suite runs side by side.
  test.slow();
  await ownWorld(context, testInfo, "yasam");
  const model = modelFor(testInfo, "Yaşam");
  const card = page.getByRole("heading", { level: 3, name: `Deneme ${model}` });

  await page.goto("/yonetim/modeller/yeni");
  await fillModel(page, model);
  await page.getByRole("button", { name: "Modeli oluştur" }).click();
  await expect(page).toHaveURL(/\/yonetim\/modeller$/);
  await expect(page.getByRole("status").filter({ hasText: "Model oluşturuldu" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name: `Deneme ${model}`, exact: true })).toBeVisible();

  await page.goto("/");
  await expect(card).toBeVisible();

  // Retired: the page says what retiring does, and asks first.
  await page.goto("/yonetim/modeller");
  await page.getByRole("link", { name: `Deneme ${model}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Deneme ${model}` })).toBeVisible();
  await expect(page.getByText("Bu model şimdi kaldırılamaz")).toHaveCount(0);
  await (await hydrated(page.getByRole("button", { name: "Modeli kaldır" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Deneme ${model} kaldırılsın mı?`);
  await dialog.getByRole("button", { name: "Modeli kaldır" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Model kaldırıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modeli geri getir" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expect(card).toHaveCount(0);

  // The panel still has it, as retired; restoring it brings it back.
  await page.goto("/yonetim/modeller?durum=RETIRED");
  await page.getByRole("link", { name: `Deneme ${model}`, exact: true }).click();
  await (await hydrated(page.getByRole("button", { name: "Modeli geri getir" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Model yeniden yayında" })).toBeVisible();
  await page.goto("/");
  await expect(card).toBeVisible();
});

test("a model with a booking to come cannot be retired: the reason is on the page, with its number", async ({ page, context }, testInfo) => {
  // The Clio has a booking to come. The retiring is refused, so nothing is changed, but the page is its own world anyway.
  await ownWorld(context, testInfo, "dolu");
  await page.goto("/yonetim/modeller/renault-clio");
  await expect(page.getByRole("heading", { level: 1, name: "Renault Clio" })).toBeVisible();
  const blocked = page.getByText("Bu model şimdi kaldırılamaz").locator("xpath=ancestor::div[1]");
  await expect(blocked).toContainText("gelecek rezervasyon");

  await (await hydrated(page.getByRole("button", { name: "Modeli kaldır" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Modeli kaldır" }).click();
  // Still live, and the reason is told as an alert now that the API itself said so.
  await expect(page.getByRole("alert").filter({ hasText: "Bu model şimdi kaldırılamaz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modeli kaldır" })).toBeVisible();
});

test("a model is changed: the price on the form is lira, the address cannot change, and the electric unit follows the fuel", async ({ page, context }, testInfo) => {
  await ownWorld(context, testInfo, "duzen");
  await page.goto("/yonetim/modeller/fiat-egea");
  await expect(page.getByText("Adres: fiat-egea.")).toBeVisible();
  await expect(page.getByLabel("Günlük fiyat (₺)")).toHaveValue("850");

  await (await hydrated(page.getByLabel("Günlük fiyat (₺)"))).fill("900,50");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" })).toBeVisible();
  await expect(page.getByLabel("Günlük fiyat (₺)")).toHaveValue("900,50");

  await page.getByLabel("Yakıt", { exact: true }).selectOption("ELECTRIC");
  await expect(page.getByLabel("Tüketim (kWh / 100 km)")).toBeVisible();
});

test("a form with nothing in it, an address with spaces and a price with a thousands separator say what is wrong on the field", async ({ page }) => {
  await page.goto("/yonetim/modeller/yeni");
  await (await hydrated(page.getByRole("button", { name: "Modeli oluştur" }))).click();
  await expect(page.getByText("1 ile 40 karakter arasında bir marka yazın.")).toBeVisible();
  await expect(page.getByText("Listeden bir sınıf seçin.")).toBeVisible();
  await expect(page.getByText("Türkçe açıklamayı yazın (en çok 1000 karakter).")).toBeVisible();

  await fillModel(page, "Hatalı");
  await page.getByLabel("Adres (isteğe bağlı)").fill("Hatalı Adres");
  await page.getByLabel("Günlük fiyat (₺)").fill("1.250");
  await page.getByRole("button", { name: "Modeli oluştur" }).click();
  await expect(page.getByText(/Küçük harf, rakam ve tire kullanın/)).toBeVisible();
  await expect(page.getByText(/Lira olarak yazın/)).toBeVisible();
  await expect(page).toHaveURL(/\/yeni$/);
});

test("a photo is uploaded on the form, shown from where it is stored, and kept with the model", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "foto");
  const model = modelFor(testInfo, "Foto");
  await page.goto("/yonetim/modeller/yeni");
  await fillModel(page, model);
  const picture = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#3a7a52" } }).jpeg().toBuffer();
  await page.getByLabel("Yeni fotoğraf seç").setInputFiles({ name: "arac.jpg", mimeType: "image/jpeg", buffer: picture });
  await expect(page.getByRole("status").filter({ hasText: "Yüklendi" })).toBeVisible();
  await page.getByRole("button", { name: "Modeli oluştur" }).click();
  await expect(page).toHaveURL(/\/yonetim\/modeller$/);

  await page.getByRole("link", { name: `Deneme ${model}`, exact: true }).click();
  const photo = page.getByRole("img", { name: `Deneme ${model} fotoğrafı` });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", /^\/mock-uploads\/[0-9a-f-]{36}\.webp$/);
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/models");
  await expect(page.getByRole("heading", { level: 1, name: "Vehicle models" })).toBeVisible();
  await page.getByRole("link", { name: "New model" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/models\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "New model" })).toBeVisible();
  await expect(page.getByLabel("Brand")).toBeVisible();
  await expect(page.getByLabel("Daily price (₺)")).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "individual");
  for (const path of ["/yonetim/modeller", "/yonetim/modeller/yeni", "/yonetim/modeller/fiat-egea"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("no horizontal scroll on the list, the form or a model at this width", async ({ page }) => {
  for (const path of ["/yonetim/modeller", "/yonetim/modeller/yeni", "/yonetim/modeller/fiat-egea"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
