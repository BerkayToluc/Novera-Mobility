import { expect, test } from "@playwright/test";

// SPEC §8 steps 2 and 3: from the results, hold a car, add an extra, pay with the test card and
// reach the confirmation. The search itself is opened by address; the form is covered separately.
const RESULTS =
  "/araclar?alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00";

test.beforeEach(async ({ context }) => {
  // The cookie banner is not what these tests are about; it has its own spec.
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("Kirala holds the car and opens the summary with a countdown", async ({ page }) => {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();

  await expect(page).toHaveURL(/\/rezervasyon\?.*tutma=/);
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyon Özeti" })).toBeVisible();
  await expect(page.getByText(/Kalan süre/)).toBeVisible();
  // The car's own price is on the summary, with VAT said to be included.
  await expect(page.getByText("₺2.400").first()).toBeVisible();
  await expect(page.getByText(/KDV dahildir/)).toBeVisible();
});

test("an extra changes the total the server reports", async ({ page }) => {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);

  await page.getByRole("checkbox", { name: "Ek sürücü" }).check();
  await expect(page).toHaveURL(/ek=additional-driver/);
  // ₺2.400 for three days plus ₺150 a day for the extra driver.
  await expect(page.getByText("₺2.850").first()).toBeVisible();
  await page.getByRole("checkbox", { name: "Ek sürücü" }).uncheck();
  await expect(page.getByText("₺2.850")).toHaveCount(0);
});

test("pay with the test card and reach the confirmation", async ({ page }) => {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await page.getByRole("link", { name: "Ödemeye Geç" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();
  await page.getByLabel("Karttaki isim").fill("Elif Yıldız");
  await page.getByLabel("Kart numarası").fill("4242 4242 4242 4242");
  await page.getByLabel(/Son kullanma/).fill("12/30");
  await page.getByLabel("CVC").fill("123");
  await page.getByRole("button", { name: /Öde|Tamamla/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyonunuz alındı" })).toBeVisible();
  await expect(page.getByText(/NVR-\d{4}-\d{5}/)).toBeVisible();
  // The hold is spent, so it does not travel on to the confirmation.
  expect(page.url()).not.toContain("tutma=");
});

test("an expired hold shows the time-is-up screen and leads back to the search", async ({ page }) => {
  const expired = `/rezervasyon?alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00&arac=renault-clio-istanbul-kadikoy&tutma=1000.renault-clio-istanbul-kadikoy`;
  await page.goto(expired);
  await expect(page.getByRole("heading", { name: "Süre doldu" })).toBeVisible();
  await page.getByRole("link", { name: "Aramaya dön" }).click();
  await expect(page).toHaveURL(/\/araclar\?/);
});

test("the summary states the cancellation rule before paying", async ({ page }) => {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByText(/24 saat öncesine kadar ücretsiz iptal/)).toBeVisible();
  // The footer has a link with the same words; this is the one in the price panel.
  await expect(page.getByRole("main").getByRole("link", { name: "Kiralama koşulları", exact: true })).toHaveAttribute(
    "href",
    "/kiralama-kosullari",
  );
});
