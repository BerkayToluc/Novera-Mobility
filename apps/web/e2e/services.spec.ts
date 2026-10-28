import { expect, test } from "./fixtures";

// Services (SPEC §2.5, v0.9): five cards, each service told with three steps and its packages,
// a few figures, which product includes which service, and what to do in an emergency.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("five cards lead to five sections, each with three steps and its packages", async ({ page }) => {
  await page.goto("/hizmetler");
  const cards = page.getByRole("region", { name: "Hizmetlere genel bakış" }).getByRole("link");
  await expect(cards).toHaveCount(5);
  await cards.nth(2).click();
  await expect(page).toHaveURL(/#hizmet-3$/);

  const section = page.locator("#hizmet-3");
  await expect(section.getByRole("heading", { level: 2, name: "Kesintisiz İkame (Yedek) Araç" })).toBeVisible();
  await expect(section.getByRole("listitem").filter({ hasText: "Kurumsal" })).toBeVisible();
  await expect(section.getByRole("listitem").filter({ hasText: "VIP Mobilite" })).toBeVisible();
  // The replacement car is not in the individual package.
  await expect(section.getByRole("listitem").filter({ hasText: /^Bireysel$/ })).toHaveCount(0);
  await expect(section.getByRole("list").last().getByRole("listitem")).toHaveCount(3);
});

test("a link from elsewhere to one service still lands on its section", async ({ page }) => {
  await page.goto("/hizmetler?hizmet=1#hizmet-1");
  await expect(page.locator("#hizmet-1")).toBeInViewport();
});

test("the figures count up to their values", async ({ page }) => {
  await page.goto("/hizmetler");
  const stats = page.locator("section[aria-labelledby=service-stats]");
  await stats.scrollIntoViewIfNeeded();
  await expect(stats.getByText("ortalama yol yardım ulaşım süresi")).toBeVisible();
  await expect(stats.locator("dd").first()).toContainText("35");
  await expect(stats.locator("dd").first()).toContainText("dk");
});

test("the coverage table names each product and marks each service with a word, not colour alone", async ({ page }) => {
  await page.goto("/hizmetler");
  const table = page.getByRole("table", { name: "Hizmetlerin ürünlere göre dağılımı" });
  await expect(table.getByRole("columnheader")).toHaveCount(5);
  await expect(table.getByRole("row")).toHaveCount(6);
  const flexible = table.getByRole("row").filter({ hasText: "Kesintisiz İkame" });
  const cells = flexible.getByRole("cell");
  await expect(cells).toHaveCount(4);
  // Akıllı Kurumsal Filo includes it, Esnek ve Kısa Dönem does not.
  await expect(cells.nth(0)).toContainText("Dahil");
  await expect(cells.nth(2)).toContainText("Dahil değil");
  await expect(table.getByRole("link", { name: /Yeşil Filo/ })).toHaveAttribute("href", "/urunler/yesil-filo");
});

test("the emergency band gives the line to call or copy, and leads to the Road Assurance", async ({ page }) => {
  await page.goto("/hizmetler");
  const band = page.locator("section[aria-labelledby=service-emergency]");
  await band.getByRole("button", { name: "+90 850 555 00 11" }).click();
  await expect(band.getByRole("link", { name: "Ara" })).toHaveAttribute("href", /^tel:\+908505550011/);
  await page.keyboard.press("Escape");
  await band.getByRole("link", { name: "Yol Boyu Güvence'yi inceleyin" }).click();
  await expect(page).toHaveURL(/#yol-boyu-guvence$/);
  await expect(page.locator("#yol-boyu-guvence")).toBeInViewport();
});
