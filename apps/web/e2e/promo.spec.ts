import { expect, test, type Page } from "@playwright/test";
import { RESULTS } from "./driver-helpers";
import { signInSample } from "./mock-session";

// SPEC §2.3: a campaign code on the booking summary, kept in the address, priced by the server
// (it moved here from the payment page, G's decision).
async function goToSummary(page: Page) {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyon Özeti" })).toBeVisible();
}
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("a campaign code takes its percentage off and shows on the summary line and the total", async ({ page }) => {
  await goToSummary(page); // the Clio for three days: ₺2.400
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("novera10");
  await box.getByRole("button", { name: "Uygula" }).click();

  await expect(page).toHaveURL(/kod=NOVERA10/);
  await expect(box.getByText("NOVERA10 uygulandı: %10 indirim.")).toBeVisible();
  // 10 percent of ₺2.400 is ₺240: the line, and the total ₺2.160 in the price block and the bar.
  await expect(page.getByText(/Kampanya indirimi \(NOVERA10, %10\)/)).toBeVisible();
  await expect(page.getByText("−₺240")).toBeVisible();
  await expect(page.getByText("₺2.160").first()).toBeVisible();

  await box.getByRole("button", { name: "Kaldır" }).click();
  await expect(page).not.toHaveURL(/kod=/);
  await expect(page.getByText(/Kampanya indirimi/)).toHaveCount(0);
  await expect(page.getByText("₺2.400").first()).toBeVisible();
});

test("a code that does not exist is said so, and the price stays the plain one", async ({ page }) => {
  await goToSummary(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("YOKBOYLEKOD");
  await box.getByRole("button", { name: "Uygula" }).click();
  await expect(box.getByRole("alert")).toContainText("geçerli bir kampanya kodu değil");
  await expect(page.getByText(/Kampanya indirimi/)).toHaveCount(0);
  await expect(page.getByText("₺2.400").first()).toBeVisible();
});

test("pressing Enter in the code box applies the code and does not pay", async ({ page }) => {
  await goToSummary(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("HOSGELDIN");
  await page.keyboard.press("Enter");
  await expect(box.getByText("HOSGELDIN uygulandı: %5 indirim.")).toBeVisible();
  // Enter applies the code on the summary and does not go on to pay.
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyon Özeti" })).toBeVisible();
});

test("the discount travels on to the payment page, which no longer has the code box", async ({ page, context }) => {
  await signInSample(context);
  await goToSummary(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("NOVERA10");
  await box.getByRole("button", { name: "Uygula" }).click();
  await expect(page).toHaveURL(/kod=NOVERA10/);
  await page.getByRole("link", { name: "Ödemeye Geç" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kampanya kodu" })).toHaveCount(0);
  await expect(page.getByText(/Kampanya indirimi \(NOVERA10/)).toBeVisible();
  await expect(page.getByText("₺2.160").first()).toBeVisible();
});

test("the summary shows how much of the total is VAT, and a subtotal once a code comes off", async ({ page }) => {
  await goToSummary(page);
  // ₺2.400 with 20 percent VAT inside: ₺400.
  await expect(page.locator("p").filter({ hasText: /KDV'si \(%20\) dahildir/ })).toContainText("₺400");
  await expect(page.getByText("Ara toplam")).toHaveCount(0);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("NOVERA10");
  await box.getByRole("button", { name: "Uygula" }).click();
  await expect(page.getByText("Ara toplam")).toBeVisible();
  // ₺2.160 less its sixth: ₺360.
  await expect(page.locator("p").filter({ hasText: /KDV'si \(%20\) dahildir/ })).toContainText("₺360");
});
