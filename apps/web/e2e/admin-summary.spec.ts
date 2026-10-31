import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// The summary screen (V2-25, docs/ADMIN.md §3). The sample numbers are in mocks/admin.ts: 4 starting, 2 ending, 17 in the
// last seven days, 3 quotes waiting; messages and service requests have no source yet, so their cards are not drawn.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

test("the summary shows the day's numbers, and the day they are for", async ({ page }) => {
  await page.goto("/yonetim");
  await expect(page.getByRole("heading", { level: 1, name: "Yönetim paneli" })).toBeVisible();
  await expect(page.getByText("29 Ekim 2026 itibarıyla (İstanbul saati)")).toBeVisible();

  const number = (label: string) => page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
  await expect(number("Bugün başlayan kiralama")).toHaveText("4");
  await expect(number("Bugün biten kiralama")).toHaveText("2");
  await expect(number("Son 7 günde yapılan rezervasyon")).toHaveText("17");
  await expect(number("Yanıt bekleyen teklif talebi")).toHaveText("3");

  // The messages have a source (V2-32) and so do the service requests (V2-41): four are not over (mocks/requests.ts).
  await expect(number("Ele alınmamış mesaj")).toHaveText("4");
  await expect(number("Açık servis talebi")).toHaveText("4");
  // The lists are built (bookings V2-31, quotes and messages V2-32, requests V2-41), so every card that is shown opens its list, narrowed
  // the way the card counts (confirmed bookings only).
  const links = page.getByRole("link", { name: "Listeyi aç" });
  await expect(links).toHaveCount(6);
  await expect(links.nth(5)).toHaveAttribute("href", /\/yonetim\/talepler\?.*durum=acik/);
  await expect(links.nth(3)).toHaveAttribute("href", /\/yonetim\/teklifler\?.*durum=RECEIVED/);
  await expect(links.nth(4)).toHaveAttribute("href", /\/yonetim\/mesajlar\?.*durum=ele-alinmadi/);
  for (const [index, filter] of ["baslangic=bugun", "bitis=bugun", "olusturma=7gun"].entries()) {
    await expect(links.nth(index)).toHaveAttribute("href", new RegExp(String.raw`/yonetim/rezervasyonlar\?.*${filter}`));
    await expect(links.nth(index)).toHaveAttribute("href", /durum=CONFIRMED/);
  }
});

test("the English panel says the same in English", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin panel" })).toBeVisible();
  await expect(page.getByText("As of October 29, 2026 (Istanbul time)")).toBeVisible();
  await expect(page.locator("dt", { hasText: "Rentals starting today" })).toBeVisible();
});

test("the cards fit at every width without the page scrolling sideways", async ({ page }) => {
  await page.goto("/yonetim");
  await expect(page.locator("dt", { hasText: "Bugün başlayan kiralama" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
