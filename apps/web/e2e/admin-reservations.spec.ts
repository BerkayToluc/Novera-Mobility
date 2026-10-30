import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The booking screens (V2-31, docs/ADMIN.md §3.2) on the five sample bookings of mocks/reservations.ts. Both widths run side by
// side against one server, and a cancellation changes what the customer sees, so a test that cancels works in a world of its own
// (the cookie of lib/mock-world.ts); the tests that only read use the shared one, which nobody changes.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or the cancellation the first attempt made would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

const CLIO = "NVR-2026-00207"; // two days ahead, picks up at Ankara
const PASSAT = "NVR-2026-00231"; // a month ahead
const DONE = "NVR-2026-00142"; // finished
const CANCELLED = "NVR-2026-00098"; // cancelled by the customer

test("the list shows each booking with its customer, car, branch, start, state and total, and narrows by state and search", async ({ page }) => {
  await page.goto("/yonetim/rezervasyonlar");
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyonlar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Rezervasyonlar" });
  const row = (number: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name: number, exact: true }) });
  await expect(table.getByRole("row")).toHaveCount(6);
  await expect(row(CLIO)).toContainText("Elif Yıldız");
  await expect(row(CLIO)).toContainText("Renault Clio");
  await expect(row(CLIO)).toContainText("Esenboğa Havalimanı");
  await expect(row(CLIO)).toContainText("Yaklaşan");
  await expect(row(DONE)).toContainText("Tamamlandı");
  await expect(row(CANCELLED)).toContainText("İptal");

  // The state, in the address.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "İptal" }).click();
  await expect(page).toHaveURL(/durum=CANCELLED/);
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(row(CANCELLED)).toBeVisible();

  // A part of a number, in any case, and a part of an e-mail.
  await page.goto("/yonetim/rezervasyonlar?ara=nvr-2026-00231");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(row(PASSAT)).toBeVisible();
  await page.goto("/yonetim/rezervasyonlar?ara=kimse%40example");
  await expect(page.getByText("Bu aramaya uyan rezervasyon yok")).toBeVisible();
});

test("the list narrows by pick-up branch and by the days the rental starts on, and the filters stay in the address", async ({ page }) => {
  await page.goto("/yonetim/rezervasyonlar");
  const table = page.getByRole("table", { name: "Rezervasyonlar" });

  // The branch is chosen and applied with a button, not by the choice itself.
  await (await hydrated(page.getByLabel("Alış bayisine göre"))).selectOption("ankara-esenboga");
  await expect(page).not.toHaveURL(/bayi=/);
  await page.getByRole("button", { name: "Süz" }).first().click();
  await expect(page).toHaveURL(/bayi=ankara-esenboga/);
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("link", { name: CLIO, exact: true })).toBeVisible();

  // The days, both included: a window in the future that holds only the booking a month ahead.
  const in20 = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const in40 = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/yonetim/rezervasyonlar");
  await page.getByLabel("İlk gün").fill(in20);
  await page.getByLabel("Son gün").fill(in40);
  await page.getByRole("button", { name: "Süz" }).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`bas=${in20}&bit=${in40}|bit=${in40}&bas=${in20}`));
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("link", { name: PASSAT, exact: true })).toBeVisible();
  await expect(page.getByLabel("İlk gün")).toHaveValue(in20);

  // A day that is not a day is left out: the list is shown, not an error.
  await page.goto("/yonetim/rezervasyonlar?bas=yarin&bit=2026-02-30");
  await expect(table.getByRole("row")).toHaveCount(6);
});

test("a card of the summary opens the list narrowed the way the card counts, says so, and the filter can be taken off", async ({ page }) => {
  await page.goto("/yonetim");
  await page.getByRole("link", { name: "Listeyi aç" }).first().click();
  await expect(page).toHaveURL(/\/yonetim\/rezervasyonlar\?.*baslangic=bugun/);
  await expect(page).toHaveURL(/durum=CONFIRMED/);
  await expect(page.getByText("Bugün başlayan kiralamalar (İstanbul günü).")).toBeVisible();
  // In the sample data nothing starts on the day the test runs, so the list is empty with its own message.
  await expect(page.getByText("Bu aramaya uyan rezervasyon yok")).toBeVisible();

  await page.getByRole("link", { name: "Süzgeci kaldır" }).click();
  await expect(page).not.toHaveURL(/baslangic=/);
  await expect(page.getByText("Bugün başlayan kiralamalar (İstanbul günü).")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Rezervasyonlar" }).getByRole("row")).toHaveCount(5); // the header and the four confirmed ones: the state stays
});

test("a booking is opened: the rental, the price as it was made, the points, and the customer", async ({ page }) => {
  await page.goto("/yonetim/rezervasyonlar");
  await page.getByRole("link", { name: CLIO, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: CLIO })).toBeVisible();
  await expect(page.getByText("Elif Yıldız, elif.yildiz@example.com")).toBeVisible();
  await expect(page.getByText("Esenboğa Havalimanı (Ankara)").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fiyat" })).toBeVisible();
  await expect(page.getByText("Kampanya kodu yok.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rezervasyonu iptal et" })).toBeVisible();
});

test("a booking is cancelled with a reason; it says so on the booking, in the list and on the customer's own screen", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "iptal");
  await page.goto(`/yonetim/rezervasyonlar/${CLIO}`);
  await (await hydrated(page.getByRole("button", { name: "Rezervasyonu iptal et" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`${CLIO} iptal edilsin mi?`);

  // A reason that is too short is refused on the field, and nothing is cancelled.
  await dialog.getByLabel("İptal nedeni").fill("kısa");
  await dialog.getByRole("button", { name: "Rezervasyonu iptal et" }).click();
  await expect(dialog.getByText("5 ile 500 karakter arasında bir neden yazın.")).toBeVisible();

  await dialog.getByLabel("İptal nedeni").fill("Müşteri aradı, kiralamayı istemiyor.");
  await dialog.getByRole("button", { name: "Rezervasyonu iptal et" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rezervasyon iptal edildi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "İptal", exact: true })).toBeVisible();
  await expect(page.getByText("Neden: Müşteri aradı, kiralamayı istemiyor.")).toBeVisible();
  await expect(page.getByText("İptal eden: Deniz Yönetici (yönetici)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rezervasyonu iptal et" })).toHaveCount(0);

  // The list shows it as cancelled.
  await page.goto("/yonetim/rezervasyonlar?durum=CANCELLED");
  await expect(page.getByRole("table").getByRole("link", { name: CLIO, exact: true })).toBeVisible();

  // The customer sees it on their own screen.
  await signInSample(context, "individual");
  await page.goto("/profil/rezervasyonlar?durum=iptal");
  await expect(page.getByText("Renault Clio").first()).toBeVisible();
});

test("a booking that has started or is already cancelled cannot be cancelled: there is no button, and the page says why", async ({ page }) => {
  await page.goto(`/yonetim/rezervasyonlar/${DONE}`);
  await expect(page.getByText("Kiralama başlamış, bu yüzden iptal edilemez.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rezervasyonu iptal et" })).toHaveCount(0);

  await page.goto(`/yonetim/rezervasyonlar/${CANCELLED}`);
  await expect(page.getByText("Müşteri kendisi iptal etti.")).toBeVisible();
  await expect(page.getByText("Bu rezervasyon iptal edilmiş.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rezervasyonu iptal et" })).toHaveCount(0);
});

test("the dialog starts on the safe answer, and Escape closes it without cancelling", async ({ page, context }, testInfo) => {
  await ownWorld(context, testInfo, "vazgec");
  await page.goto(`/yonetim/rezervasyonlar/${PASSAT}`);
  await (await hydrated(page.getByRole("button", { name: "Rezervasyonu iptal et" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Rezervasyonu iptal et" })).toBeVisible();
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/reservations");
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
  await page.getByRole("link", { name: CLIO, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/admin/reservations/${CLIO}$`));
  await expect(page.getByRole("heading", { level: 1, name: CLIO })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel the booking" })).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "individual");
  for (const path of ["/yonetim/rezervasyonlar", `/yonetim/rezervasyonlar/${CLIO}`]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("a number that is not there, or cannot be one, shows the page that does not exist", async ({ page }) => {
  // The page streams, so its status is already sent when the booking turns out not to exist: what is shown is the not-found page.
  for (const path of ["/yonetim/rezervasyonlar/NVR-0000-00000", "/yonetim/rezervasyonlar/bu-bir-numara-degil"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Sayfa bulunamadı" }), path).toBeVisible();
  }
});

test("no horizontal scroll on the list or a booking at this width", async ({ page }) => {
  for (const path of ["/yonetim/rezervasyonlar", `/yonetim/rezervasyonlar/${CLIO}`, `/yonetim/rezervasyonlar/${CANCELLED}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
