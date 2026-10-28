import { EXPERIENCED, fillDriver } from "../e2e/driver-helpers";
import { expect, test } from "../e2e/fixtures";

// V2-19 (QUALITY T-01): the core of SPEC §6 item 1 through the real API and a real database, from nothing: a new account,
// a search, a hold, the summary, payment, the confirmation, the booking in the account, and its cancellation.
// Each step is a page of the site calling the API as it does in production (the shared key, the visitor's address, the
// session cookie), so a break between the two halves shows here and nowhere in the sample-data tests.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3201" },
  ]);
});

test("sign up, search, hold, pay, see the booking, cancel it", async ({ page }) => {
  const email = `smoke-${Date.now()}@example.test`;

  // 1. A new account, from the sign-up page.
  await page.goto("/kayit");
  await page.getByLabel("Ad", { exact: true }).fill("Selin");
  await page.getByLabel("Soyad").fill("Kaya");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("uzun-bir-sifre-1");
  await page.getByRole("checkbox", { name: /KVKK/ }).check();
  await page.getByRole("button", { name: "Kayıt Ol" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hoş geldin, Selin" })).toBeVisible();

  // 2. The search, from the home page, with the branches the API lists.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Alış bayisi" }).click();
  await page.getByRole("option", { name: /İstanbul Kadıköy/ }).click();
  await page.getByRole("combobox", { name: "Bırakacağınız bayi" }).click();
  await page.getByRole("option", { name: /İstanbul Havalimanı/ }).click();
  await page.getByRole("button", { name: /Alış ve iade tarihleri|Tarih aralığı seçin/ }).click();
  // Next month, so the days are in the future whenever this runs.
  await page.getByRole("button", { name: /Sonraki ay|Next month/i }).click();
  await page.getByRole("button", { name: /(^|\D)15(\D|$)/ }).first().click();
  await page.getByRole("button", { name: /(^|\D)18(\D|$)/ }).first().click();
  await page.getByRole("button", { name: "Uygula" }).click();
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Uygun Araçlar" })).toBeVisible();

  // 3. Kirala holds a car (POST /holds) and opens the summary with its countdown.
  await page.getByRole("button", { name: /Kirala/ }).first().click();
  await expect(page).toHaveURL(/\/rezervasyon\?.*tutma=/);
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyon Özeti" })).toBeVisible();
  await expect(page.getByText(/Kalan süre/)).toBeVisible();

  // 4. Payment: the driver, the licence check, the card; then the reservation is made (POST /reservations).
  await page.getByRole("link", { name: "Ödemeye Geç" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await fillDriver(page, EXPERIENCED);
  await page.getByRole("button", { name: "Ehliyetimi doğrula" }).click();
  await expect(page.getByText("Ehliyet doğrulandı (deneme).")).toBeVisible();
  await page.getByLabel("Karttaki isim").fill("Selin Kaya");
  await page.getByLabel("Kart numarası").fill("4242 4242 4242 4242");
  await page.getByLabel(/Son kullanma/).fill("12/30");
  await page.getByLabel("CVC").fill("123");
  await page.getByRole("button", { name: /Öde|Tamamla/ }).click();

  // 5. The confirmation carries the reservation number the database made.
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyonunuz alındı" })).toBeVisible();
  const number = (await page.getByText(/NVR-\d{4}-\d{5,}/).first().innerText()).match(/NVR-\d{4}-\d{5,}/)![0];

  // 6. The booking is in the account, as coming.
  await page.goto("/profil/rezervasyonlar");
  const card = page.getByRole("listitem").filter({ hasText: number });
  await expect(card).toBeVisible();
  await expect(card.getByText("Yaklaşan", { exact: true })).toBeVisible();

  // 7. Cancelled after the question; the card says so and offers no second cancel.
  await card.getByRole("button", { name: /İptal et/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Evet, iptal et" }).click();
  const cancelled = page.getByRole("listitem").filter({ hasText: number });
  await expect(cancelled.getByText("İptal edildi", { exact: true })).toBeVisible();
  await expect(cancelled.getByRole("button", { name: /İptal et/ })).toHaveCount(0);
});
