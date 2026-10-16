import { expect, test, type Page } from "@playwright/test";
import { RESULTS } from "./driver-helpers";

// The results page (SPEC §2.3): a Filtrele panel that narrows and orders the list through the
// address, and "Puanla öde" for a signed-in individual account.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const count = (page: Page) => page.locator("#results-heading");

async function signIn(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
}

test("the Filtrele panel narrows the list through the address and can be cleared", async ({ page }) => {
  await page.goto(RESULTS);
  const total = Number((await count(page).innerText()).match(/\d+/)![0]);
  expect(total).toBeGreaterThan(1);

  await page.getByRole("button", { name: /Filtrele/ }).click();
  const panel = page.getByRole("dialog", { name: "Filtreler" });
  await panel.getByRole("button", { name: "Otomatik vites" }).click();
  await expect(page).toHaveURL(/vites=otomatik/);
  // The search stays in the address, and the filter count shows on the button.
  await expect(page).toHaveURL(/alis=istanbul-kadikoy/);
  await expect(page.getByRole("button", { name: /Filtrele.*1/ })).toBeVisible();
  const narrowed = Number((await count(page).innerText()).match(/\d+/)![0]);
  expect(narrowed).toBeLessThan(total);
  for (const card of await page.getByRole("article").all()) await expect(card).toContainText("Otomatik vites");

  // Pressed again, the chip clears its group; "Filtreleri temizle" clears them all.
  await panel.getByRole("button", { name: "Otomatik vites" }).click();
  await expect(page).not.toHaveURL(/vites=/);
  await panel.getByRole("group", { name: "Yakıt" }).getByRole("button", { name: "Elektrikli" }).click();
  await panel.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(page).not.toHaveURL(/yakit=/);
  expect(Number((await count(page).innerText()).match(/\d+/)![0])).toBe(total);
});

test("a filter with no match says so, and offers to clear it", async ({ page }) => {
  await page.goto(`${RESULTS}&sinif=yok-boyle-sinif`);
  await expect(page.getByRole("heading", { name: "Bu filtrelere uyan araç yok" })).toBeVisible();
  await page.getByRole("link", { name: "Filtreleri temizle" }).click();
  await expect(page).not.toHaveURL(/sinif=/);
  await expect(count(page)).toBeVisible();
});

test("the order can be changed: most expensive first", async ({ page }) => {
  await page.goto(`${RESULTS}&sirala=azalan`);
  // Wait for the cards to render before reading them; evaluateAll does not wait.
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.locator("[data-total]").nth(1)).toBeVisible();
  const prices = await page.getByRole("article").evaluateAll((cards) =>
    cards.map((card) => Number((card.querySelector("[data-total]")?.textContent ?? "").replace(/[^\d]/g, ""))),
  );
  expect(prices.length).toBeGreaterThan(1);
  expect(prices).toEqual([...prices].sort((a, b) => b - a));
});

test("a visitor who is not signed in is invited to sign in for points", async ({ page }) => {
  await page.goto(RESULTS);
  await expect(page.getByRole("switch", { name: /Puanla öde/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Puanla ödemek için giriş yapın" })).toBeVisible();
});

test("a signed-in individual can pay with points: each card shows points plus money, and Kirala carries it", async ({ page }) => {
  await signIn(page);
  await page.goto(RESULTS);
  const toggle = page.getByRole("switch", { name: /Puanla öde/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("article").first()).not.toContainText(" puan + ");

  await toggle.click();
  await expect(page).toHaveURL(/puan=1/);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const first = page.getByRole("article").first();
  await expect(first).toContainText(/\d[\d.]* puan \+ ₺/);
  // The full total is struck through, and the points plus the rest stand beside it.
  const struck = first.locator("del");
  await expect(struck).toHaveText("₺2.400");
  await expect(struck).toHaveCSS("text-decoration-line", "line-through");
  // The switch no longer carries the balance, only what one point is worth.
  await expect(toggle).not.toContainText("165 puan =");
  await expect(toggle).toContainText("1 puan = ₺5");

  await first.getByRole("button", { name: /Kirala/ }).click();
  await page.waitForURL(/\/rezervasyon\?.*puan=1/);
});
