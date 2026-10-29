import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The vehicle and extra service screens (V2-30, docs/ADMIN.md §3.1) on the sample fleet of mocks/fleet-world.ts. Both widths run
// side by side against one server, and other specs count what is on the site, so a test that changes the fleet works in a world
// of its own (the cookie of lib/mock-world.ts); the tests that only read use the shared one, which nobody changes.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or the car the first attempt made would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

async function addVehicle(page: Page, plate: string, modelSlug: string, branchId: string, year = "2026") {
  await page.goto("/yonetim/araclar/yeni");
  await (await hydrated(page.getByLabel("Plaka"))).fill(plate);
  await page.getByLabel("Model yılı").fill(year);
  await page.getByLabel("Model", { exact: true }).selectOption(modelSlug);
  await page.getByLabel("Bayi", { exact: true }).selectOption(branchId);
  await page.getByRole("button", { name: "Aracı ekle" }).click();
}

test("the list shows each car with its model, branch, year and state, and narrows by state, model, branch and plate", async ({ page }) => {
  await page.goto("/yonetim/araclar");
  await expect(page.getByRole("heading", { level: 1, name: "Araçlar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Araçlar" });
  await expect(table.getByRole("row").nth(1)).toContainText("Açık");

  // The state: none of the sample cars is switched off.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Kapalı" }).click();
  await expect(page).toHaveURL(/durum=INACTIVE/);
  await expect(page.getByText("Bu aramaya uyan araç yok")).toBeVisible();

  // The model is chosen and applied with a button, not by the choice itself.
  await page.goto("/yonetim/araclar");
  await (await hydrated(page.getByLabel("Modele göre"))).selectOption("fiat-egea");
  await expect(page).not.toHaveURL(/model=/);
  await page.getByRole("button", { name: "Süz" }).first().click();
  await expect(page).toHaveURL(/model=fiat-egea/);
  await expect(table.getByRole("row").nth(1)).toContainText("Fiat Egea");
  await expect(table.getByRole("cell", { name: "Renault Clio" })).toHaveCount(0);

  // The branch, and a plate typed without its spaces.
  await page.goto("/yonetim/araclar?bayi=istanbul-kadikoy");
  await expect(table.getByRole("row").nth(1)).toContainText("Kadıköy");
  await page.goto("/yonetim/araclar?ara=34nv1001");
  await expect(table.getByRole("row")).toHaveCount(2);
});

test("a new car is on the list, counts for its model, and a plate that is used is refused on the field", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "ekle");

  await page.goto("/yonetim/modeller?ara=clio");
  const clioRow = page.getByRole("table").getByRole("row").filter({ has: page.getByRole("link", { name: "Renault Clio", exact: true }) });
  const countBefore = Number((await clioRow.getByRole("cell").nth(4).textContent())!.trim());

  await addVehicle(page, "16 abc 4321", "renault-clio", "bursa-nilufer");
  await expect(page).toHaveURL(/\/yonetim\/araclar$/);
  await expect(page.getByRole("status").filter({ hasText: "Araç eklendi" })).toBeVisible();
  // Written the one way, whatever way it was typed.
  await expect(page.getByRole("table").getByRole("link", { name: "16 ABC 4321", exact: true })).toBeVisible();

  await page.goto("/yonetim/modeller?ara=clio");
  await expect(clioRow.getByRole("cell").nth(4)).toHaveText(String(countBefore + 1));

  // The same plate again, typed differently.
  await addVehicle(page, "16-abc-4321", "renault-clio", "bursa-nilufer");
  await expect(page.getByText("Bu plaka başka bir araçta kayıtlı.")).toBeVisible();
  await expect(page).toHaveURL(/\/yeni$/);
});

test("a car is moved to another branch, switched off, and switched on again", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "tasi");
  await addVehicle(page, "16 TAS 100", "fiat-egea", "bursa-nilufer");
  await expect(page).toHaveURL(/\/yonetim\/araclar$/);
  await page.getByRole("link", { name: "16 TAS 100", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "16 TAS 100" })).toBeVisible();
  await expect(page.getByText("Plaka, yıl ve model değişmez.")).toBeVisible();

  // Moved: the box shows where it is, and the button waits for a change.
  const branch = page.getByLabel("Bayi", { exact: true });
  await expect(page.getByRole("button", { name: "Bayiyi değiştir" })).toBeDisabled();
  await (await hydrated(branch)).selectOption("konya-merkez");
  await page.getByRole("button", { name: "Bayiyi değiştir" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç taşındı" })).toBeVisible();
  await expect(page.getByText(/Merkez bayisinde/)).toBeVisible();

  // Switched off: it asks first.
  await (await hydrated(page.getByRole("button", { name: "Aracı kapat" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("16 TAS 100 kapatılsın mı?");
  await dialog.getByRole("button", { name: "Aracı kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç kapatıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aracı yeniden aç" })).toBeVisible();

  await page.goto("/yonetim/araclar?durum=INACTIVE");
  await expect(page.getByRole("table").getByRole("link", { name: "16 TAS 100", exact: true })).toBeVisible();

  // Switched on again.
  await page.getByRole("link", { name: "16 TAS 100", exact: true }).click();
  await (await hydrated(page.getByRole("button", { name: "Aracı yeniden aç" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç yeniden açıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aracı kapat" })).toBeVisible();
});

test("a car with a booking to come cannot be switched off or moved: the reason is on the page, with its number", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "dolu");
  // The sample Clio booking picks up at Ankara; a Clio added there is the first one and carries it.
  await addVehicle(page, "06 DOL 100", "renault-clio", "ankara-esenboga");
  await page.getByRole("link", { name: "06 DOL 100", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "06 DOL 100" })).toBeVisible();
  const blocked = page.getByText("Bu araç şimdi kapatılamaz").locator("xpath=ancestor::div[1]");
  await expect(blocked).toContainText("gelecek rezervasyon");

  await (await hydrated(page.getByRole("button", { name: "Aracı kapat" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aracı kapat" }).click();
  // Still on, and the reason is told as an alert now that the API itself said so.
  await expect(page.getByRole("alert").filter({ hasText: "Bu araç şimdi kapatılamaz" })).toBeVisible();

  await page.getByLabel("Bayi", { exact: true }).selectOption("konya-merkez");
  await page.getByRole("button", { name: "Bayiyi değiştir" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bu araç şimdi taşınamaz" })).toBeVisible();
});

test("a form with nothing in it, a plate that is not Turkish and a year out of range say what is wrong on the field", async ({ page }) => {
  await page.goto("/yonetim/araclar/yeni");
  await (await hydrated(page.getByRole("button", { name: "Aracı ekle" }))).click();
  await expect(page.getByText("Geçerli bir Türk plakası yazın (örnek: 34 ABC 123).")).toBeVisible();
  await expect(page.getByText("Listeden bir model seçin.")).toBeVisible();
  await expect(page.getByText("Listeden bir bayi seçin.")).toBeVisible();

  await page.getByLabel("Plaka").fill("99 QWX 1");
  await page.getByLabel("Model yılı").fill("2010");
  await page.getByRole("button", { name: "Aracı ekle" }).click();
  await expect(page.getByText(/ile \d{4} arasında bir yıl yazın/)).toBeVisible();
  await expect(page).toHaveURL(/\/yeni$/);
});

test("the extra services are listed with their price and how they are priced, and a changed price shows on the list", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "ek");
  await page.goto("/yonetim/ek-hizmetler");
  await expect(page.getByRole("heading", { level: 1, name: "Ek hizmetler" })).toBeVisible();
  const table = page.getByRole("table", { name: "Ek hizmetler" });
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: "Çocuk koltuğu", exact: true }) });
  await expect(row).toContainText("Günlük");
  await expect(row).toContainText("100");
  await expect(table.getByRole("row").filter({ hasText: "HGS etiketi" })).toContainText("Rezervasyon başına bir kez");

  await page.getByRole("link", { name: "Çocuk koltuğu", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Çocuk koltuğu" })).toBeVisible();
  await (await hydrated(page.getByLabel("Günlük fiyat (₺)"))).fill("125,50");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page).toHaveURL(/\/yonetim\/ek-hizmetler$/);
  await expect(page.getByRole("status").filter({ hasText: "Ek hizmet kaydedildi" })).toBeVisible();
  await expect(row).toContainText("125,50");
});

test("an extra service with a price that is not one, or no name, says what is wrong on the field", async ({ page }) => {
  await page.goto("/yonetim/ek-hizmetler/wifi");
  await (await hydrated(page.getByLabel("Günlük fiyat (₺)"))).fill("1.500");
  await page.getByLabel("Ad (Türkçe)").fill("");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText(/Lira olarak yazın/)).toBeVisible();
  await expect(page.getByText("Türkçe adı yazın (en çok 80 karakter).")).toBeVisible();
  await expect(page).toHaveURL(/\/wifi$/);
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/vehicles");
  await expect(page.getByRole("heading", { level: 1, name: "Vehicles" })).toBeVisible();
  await page.getByRole("link", { name: "New vehicle" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/vehicles\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "New vehicle" })).toBeVisible();
  await expect(page.getByLabel("Plate")).toBeVisible();
  await page.goto("/en/admin/extras");
  await expect(page.getByRole("heading", { level: 1, name: "Extra services" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name: "Child seat", exact: true })).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "individual");
  for (const path of ["/yonetim/araclar", "/yonetim/araclar/yeni", "/yonetim/araclar/istanbul-kadikoy__fiat-egea", "/yonetim/ek-hizmetler", "/yonetim/ek-hizmetler/wifi"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("no horizontal scroll on the lists, the forms or a car at this width", async ({ page }) => {
  for (const path of ["/yonetim/araclar", "/yonetim/araclar/yeni", "/yonetim/araclar/istanbul-kadikoy__fiat-egea", "/yonetim/ek-hizmetler", "/yonetim/ek-hizmetler/wifi"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
