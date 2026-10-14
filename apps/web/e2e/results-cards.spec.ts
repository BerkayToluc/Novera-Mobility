import { expect, test } from "@playwright/test";
import { RESULTS } from "./driver-helpers";

// The results cards and their bar (SPEC §2.3): the total first and the day's price under it, the
// fuel used per 100 km, nothing about age or years of licence, and a list or grid view.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("a card shows the total first and the day's price under it", async ({ page }) => {
  await page.goto(RESULTS);
  const clio = page.getByRole("article").filter({ hasText: "Renault Clio" });
  const text = (await clio.innerText()).replace(/\s+/g, " ");
  // The Clio for three days: ₺2.400 in all, ₺800 a day.
  expect(text.indexOf("3 gün toplam")).toBeGreaterThan(-1);
  expect(text.indexOf("₺2.400")).toBeLessThan(text.indexOf("₺800 / gün"));
  await expect(clio.locator("[data-total]")).toHaveText("₺2.400");
});

test("a card says how much it burns per 100 km, and nothing about age or years of licence", async ({ page }) => {
  await page.goto(RESULTS);
  await expect(page.getByRole("article").filter({ hasText: "Renault Clio" })).toContainText("5,2 L/100 km");
  await expect(page.getByText(/yaş · .* yıl ehliyet/)).toHaveCount(0);
  await expect(page.getByText(/En az \d+ yaş/)).toHaveCount(0);
});

test("the list is the default; the view button switches to three cards across and back", async ({ page, isMobile }) => {
  await page.goto(RESULTS);
  const list = page.getByRole("button", { name: "Liste görünümü" });
  const grid = page.getByRole("button", { name: "Izgara görünümü" });
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(page).not.toHaveURL(/gorunum=/);

  const articles = page.getByRole("article");
  const first = (await articles.nth(0).boundingBox())!;
  const second = (await articles.nth(1).boundingBox())!;
  // In the list every car has a row of its own: the second is under the first.
  expect(second.y).toBeGreaterThan(first.y + first.height - 1);
  expect(Math.abs(second.x - first.x)).toBeLessThan(2);

  await grid.click();
  await expect(page).toHaveURL(/gorunum=izgara/);
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  if (!isMobile) {
    const a = (await articles.nth(0).boundingBox())!;
    const b = (await articles.nth(1).boundingBox())!;
    // In the grid the second card sits beside the first.
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    expect(Math.abs(b.y - a.y)).toBeLessThan(2);
  }
  // The search stays in the address.
  await expect(page).toHaveURL(/alis=istanbul-kadikoy/);

  await list.click();
  await expect(page).not.toHaveURL(/gorunum=/);
});

test("the bar holds the count, the filter and the view side by side, without overflow", async ({ page }) => {
  await page.goto(RESULTS);
  await expect(page.getByRole("button", { name: /Filtrele/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Liste görünümü" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
