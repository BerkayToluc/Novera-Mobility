import { expect, test } from "@playwright/test";
import { RESULTS } from "./driver-helpers";

// Paying with points (SPEC §2.3): chosen on the results, shown on the summary as a line that takes
// money off, and switchable there; the code and the points come off in that order.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
}

test("points chosen on the results come off the summary, and can be switched off there", async ({ page }) => {
  await signIn(page);
  await page.goto(`${RESULTS}&puan=1`);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon\?.*puan=1/);

  const panel = page.locator("section[aria-labelledby=price-title]");
  const line = panel.getByText(/^Puan \(\d+ puan\)$/);
  await expect(line).toBeVisible();
  await expect(panel.getByText("Ara toplam")).toBeVisible();
  // The balance is smaller than half of ₺2.400, so all of it is spent and the total is ₺2.400 less it.
  const spent = Number((await line.innerText()).match(/\d+/)![0]);
  expect(spent).toBeGreaterThan(0);
  await expect(panel.getByText(`−₺${spent}`)).toBeVisible();

  await panel.getByRole("switch", { name: /Puanla öde/ }).click();
  await expect(page).not.toHaveURL(/puan=1/);
  await expect(panel.getByText(/^Puan \(/)).toHaveCount(0);
  await expect(panel.getByText("₺2.400").first()).toBeVisible();
});

test("a visitor who is not signed in has no points line and no switch on the summary", async ({ page }) => {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByRole("switch", { name: /Puanla öde/ })).toHaveCount(0);
  await expect(page.getByText(/^Puan \(/)).toHaveCount(0);
});
