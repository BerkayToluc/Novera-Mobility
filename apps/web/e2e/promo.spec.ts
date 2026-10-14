import { expect, test } from "@playwright/test";
import { goToPayment } from "./driver-helpers";

// SPEC §2.3: a campaign code on the payment page, kept in the address, priced by the server.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("a campaign code takes its percentage off and shows on the summary line and the total", async ({ page }) => {
  await goToPayment(page); // the Clio for three days: ₺2.400
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
  await goToPayment(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("YOKBOYLEKOD");
  await box.getByRole("button", { name: "Uygula" }).click();
  await expect(box.getByRole("alert")).toContainText("geçerli bir kampanya kodu değil");
  await expect(page.getByText(/Kampanya indirimi/)).toHaveCount(0);
  await expect(page.getByText("₺2.400").first()).toBeVisible();
});

test("pressing Enter in the code box applies the code and does not pay", async ({ page }) => {
  await goToPayment(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("HOSGELDIN");
  await page.keyboard.press("Enter");
  await expect(box.getByText("HOSGELDIN uygulandı: %5 indirim.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();
});

test("the discount travels to the summary page when the visitor goes back to it", async ({ page }) => {
  await goToPayment(page);
  const box = page.getByRole("region", { name: "Kampanya kodu" });
  await box.getByLabel("Kampanya kodunuz").fill("NOVERA10");
  await box.getByRole("button", { name: "Uygula" }).click();
  await expect(page).toHaveURL(/kod=NOVERA10/);
  await page.getByRole("link", { name: "Özete dön" }).click();
  await expect(page.getByText(/Kampanya indirimi \(NOVERA10/)).toBeVisible();
  await expect(page.getByText("₺2.160").first()).toBeVisible();
});
