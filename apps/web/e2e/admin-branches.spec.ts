import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The branch screens (V2-27, docs/ADMIN.md §3.1) on the sample branches of mocks/branches.ts. Both widths run side by side
// against one server, and other specs count the branches on the site, so a test that changes branches works in a world of its
// own (the cookie of lib/mock-world.ts); the tests that only read use the shared one, which nobody changes.
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

const nameFor = (testInfo: TestInfo, word: string) => `Deneme ${word} ${testInfo.project.name === "mobile" ? "M" : "D"}`;

async function fillBranch(page: Page, name: string, extra: { kind?: string } = {}) {
  await (await hydrated(page.getByLabel("Bayi adı"))).fill(name);
  await page.getByLabel("Şehir", { exact: true }).selectOption("Ankara");
  if (extra.kind) await page.getByLabel("Tür", { exact: true }).selectOption(extra.kind);
  await page.getByLabel("Adres").fill("Kızılay Mahallesi No: 5, Çankaya");
  await page.getByLabel("Enlem").fill("39,9179");
  await page.getByLabel("Boylam").fill("32,8627");
  await page.getByLabel("Telefon").fill("+90 312 555 01 03");
  await page.getByLabel("E-posta").fill("deneme@novera.example");
}

test("the list shows each branch with its type and state, and narrows by state, city and search", async ({ page }) => {
  await page.goto("/yonetim/bayiler");
  await expect(page.getByRole("heading", { level: 1, name: "Bayiler" })).toBeVisible();
  const table = page.getByRole("table", { name: "Bayiler" });
  const row = (name: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });
  await expect(row("Kadıköy")).toContainText("Şehir ofisi");
  await expect(row("Kadıköy")).toContainText("Açık");
  await expect(row("İstanbul Havalimanı")).toContainText("Havalimanı");

  // The state: none of the sample branches is closed.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Kapalı" }).click();
  await expect(page).toHaveURL(/durum=CLOSED/);
  await expect(page.getByText("Bu aramaya uyan bayi yok")).toBeVisible();

  // The city is chosen and applied with a button, not by the choice itself.
  await page.goto("/yonetim/bayiler");
  await (await hydrated(page.getByLabel("Şehre göre"))).selectOption("İstanbul");
  await expect(page).not.toHaveURL(/sehir=/);
  await page.getByRole("button", { name: "Süz" }).click();
  await expect(page).toHaveURL(/sehir=%C4%B0stanbul|sehir=İstanbul/);
  await expect(table.getByRole("link", { name: "Kadıköy", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: "Merkez" })).toHaveCount(0);

  // A word typed without the Turkish letters finds the branch.
  await page.goto("/yonetim/bayiler?ara=kadikoy");
  await expect(table.getByRole("link", { name: "Kadıköy", exact: true })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(2);
});

test("a new branch is on the site at once; closed it is on none of it; opened again it is back", async ({ page, context }, testInfo) => {
  // It walks the panel and three pages of the site, twice: more than the default 30 seconds when the suite runs side by side.
  test.slow();
  await ownWorld(context, testInfo, "yasam");
  const name = nameFor(testInfo, "Yaşam");

  await page.goto("/yonetim/bayiler/yeni");
  await fillBranch(page, name, { kind: "AIRPORT" });
  await page.getByRole("button", { name: "Bayiyi oluştur" }).click();
  await expect(page).toHaveURL(/\/yonetim\/bayiler$/);
  await expect(page.getByRole("status").filter({ hasText: "Bayi oluşturuldu" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name, exact: true })).toBeVisible();

  // On the Branches page, and in the search form's list.
  await page.goto("/bayilerimiz");
  await expect(page.locator("article").filter({ hasText: name })).toBeVisible();
  await page.goto("/");
  await (await hydrated(page.getByRole("combobox", { name: "Alış bayisi" }))).click();
  await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();

  // Closed: the page of the branch says what closing does, and asks first.
  await page.goto("/yonetim/bayiler");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Bu bayi şimdi kapatılamaz")).toHaveCount(0);
  await (await hydrated(page.getByRole("button", { name: "Bayiyi kapat" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(name + " kapatılsın mı?");
  await dialog.getByRole("button", { name: "Bayiyi kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bayi kapatıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bayiyi yeniden aç" })).toBeVisible();

  await page.goto("/bayilerimiz");
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.locator("article").filter({ hasText: name })).toHaveCount(0);
  await page.goto("/");
  await (await hydrated(page.getByRole("combobox", { name: "Alış bayisi" }))).click();
  await expect(page.getByRole("option", { name: /Kadıköy/ })).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(name) })).toHaveCount(0);

  // The panel still has it, as closed; opening it again brings it back.
  await page.goto("/yonetim/bayiler?durum=CLOSED");
  await page.getByRole("link", { name, exact: true }).click();
  await (await hydrated(page.getByRole("button", { name: "Bayiyi yeniden aç" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Bayi yeniden açıldı" })).toBeVisible();
  await page.goto("/bayilerimiz");
  await expect(page.locator("article").filter({ hasText: name })).toBeVisible();
});

test("a branch with cars and bookings to come cannot be closed: the reasons are on the page, with their numbers", async ({ page, context }, testInfo) => {
  // Kadıköy has cars and a booking to come. The closing is refused, so nothing is changed, but the page is its own world anyway.
  await ownWorld(context, testInfo, "dolu");
  await page.goto("/yonetim/bayiler/istanbul-kadikoy");
  await expect(page.getByRole("heading", { level: 1, name: "Kadıköy" })).toBeVisible();
  const blocked = page.getByText("Bu bayi şimdi kapatılamaz").locator("xpath=ancestor::div[1]");
  await expect(blocked).toContainText("açık araç");
  await expect(blocked).toContainText("gelecek rezervasyon");

  await (await hydrated(page.getByRole("button", { name: "Bayiyi kapat" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Bayiyi kapat" }).click();
  // Still open, and the reasons are told as an alert now that the API itself said so.
  await expect(page.getByRole("alert").filter({ hasText: "Bu bayi şimdi kapatılamaz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bayiyi kapat" })).toBeVisible();
  await page.goto("/bayilerimiz");
  await expect(page.locator("article").filter({ hasText: "Kadıköy" }).first()).toBeVisible();
});

test("a form with nothing in it, a point that is not in Türkiye and a day that closes before it opens say what is wrong on the field", async ({ page }) => {
  await page.goto("/yonetim/bayiler/yeni");
  await (await hydrated(page.getByRole("button", { name: "Bayiyi oluştur" }))).click();
  await expect(page.getByText("2 ile 80 karakter arasında bir ad yazın.")).toBeVisible();
  await expect(page.getByText("Listeden bir şehir seçin.")).toBeVisible();
  await expect(page.getByText("Geçerli bir telefon numarası yazın.")).toBeVisible();

  // Latitude and longitude the wrong way round: the usual slip, and the message says so.
  await fillBranch(page, "Ters Nokta");
  await page.getByLabel("Enlem").fill("32,86");
  await page.getByLabel("Boylam").fill("39,91");
  await page.getByRole("group", { name: "Cumartesi" }).getByLabel("Açılış").fill("18:00");
  await page.getByRole("button", { name: "Bayiyi oluştur" }).click();
  await expect(page.getByText(/Enlem ve boylamı yer değiştirmiş olabilirsiniz/)).toBeVisible();
  await expect(page.getByText("Açılış, kapanıştan önce olmalı; ya da günü kapalı olarak işaretleyin.")).toBeVisible();
  await expect(page).toHaveURL(/\/yeni$/);
});

test("the opening hours work with the keyboard: a day is marked closed, its times switch off, and they come back", async ({ page }) => {
  await page.goto("/yonetim/bayiler/yeni");
  const sunday = page.getByRole("group", { name: "Pazar" });
  const closed = sunday.getByLabel("Kapalı");
  const opens = sunday.getByLabel("Açılış");
  // A new branch starts with Sunday closed.
  await expect(closed).toBeChecked();
  await expect(opens).toBeDisabled();
  await (await hydrated(closed)).focus();
  await page.keyboard.press("Space");
  await expect(closed).not.toBeChecked();
  await expect(opens).toBeEnabled();
  await opens.fill("10:00");
  await sunday.getByLabel("Kapanış").fill("16:00");
  await closed.focus();
  await page.keyboard.press("Space");
  await expect(opens).toBeDisabled();
  await page.keyboard.press("Space");
  // What was typed is still there.
  await expect(opens).toHaveValue("10:00");
});

test("two people editing the same branch: the second save is refused with a warning that keeps what they typed", async ({ page, context }, testInfo) => {
  // Two pages and a handful of hydrations: close to the default 30 seconds when the whole suite runs side by side.
  test.slow();
  await ownWorld(context, testInfo, "cakisma");
  await page.goto("/yonetim/bayiler/yeni");
  const name = nameFor(testInfo, "Çakışma");
  await fillBranch(page, name);
  await page.getByRole("button", { name: "Bayiyi oluştur" }).click();
  await expect(page).toHaveURL(/\/yonetim\/bayiler$/);
  await page.getByRole("link", { name, exact: true }).click();
  // The page of the branch is open before its address is taken.
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const url = page.url();

  const other = await context.newPage();
  await other.goto(url);
  await (await hydrated(other.getByLabel("Telefon"))).fill("+90 312 555 11 11");
  await other.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" })).toBeVisible();

  await (await hydrated(page.getByLabel("Telefon"))).fill("+90 312 555 22 22");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "Bu kayıt siz düzenlerken değişti" });
  await expect(warning).toBeVisible();
  await expect(page.getByLabel("Telefon")).toHaveValue("+90 312 555 22 22");
  await warning.getByRole("button", { name: "Güncel kaydı yükle" }).click();
  await expect(page.getByLabel("Telefon")).toHaveValue("+90 312 555 11 11");
  await other.close();
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/branches");
  await expect(page.getByRole("heading", { level: 1, name: "Branches" })).toBeVisible();
  await page.getByRole("link", { name: "New branch" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/branches\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "New branch" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Weekdays" })).toBeVisible();
  await expect(page.getByLabel("Branch name")).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "individual");
  for (const path of ["/yonetim/bayiler", "/yonetim/bayiler/yeni", "/yonetim/bayiler/istanbul-kadikoy"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("no horizontal scroll on the list, the form or a branch at this width", async ({ page }) => {
  for (const path of ["/yonetim/bayiler", "/yonetim/bayiler/yeni", "/yonetim/bayiler/istanbul-kadikoy"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
