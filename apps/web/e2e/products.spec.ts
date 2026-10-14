import { expect, test } from "@playwright/test";

// Products (SPEC §2.5): four cards on their own washes, each one link to its page; a product
// page with its highlights, numbered technology points, a quote link carrying the product, and
// the other three products.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the list has four product cards, the most chosen first, each a link to its page", async ({ page }) => {
  await page.goto("/urunler");
  const cards = page.getByRole("main").getByRole("listitem");
  await expect(cards).toHaveCount(4);
  await expect(cards.first().getByRole("heading", { level: 2 })).toHaveText("Akıllı Kurumsal Filo Kiralama");
  await expect(cards.first().getByText("En çok tercih edilen")).toBeVisible();

  await cards.nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/\/urunler\/vip-mobilite$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/VIP Mobilite/);
});

test("a product page shows its highlights, the technology, a quote link and the other three products", async ({ page }) => {
  await page.goto("/urunler/akilli-kurumsal-filo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akıllı Kurumsal Filo Kiralama");
  const what = page.locator("#neler-var");
  await expect(what.getByRole("heading", { level: 3 })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Teknolojik artısı" })).toBeVisible();

  const quote = page.getByRole("link", { name: "Teklif Al" }).first();
  await expect(quote).toHaveAttribute("href", "/kurumsal-teklif?urun=akilli-kurumsal-filo");

  const others = page.locator("section[aria-labelledby=others-title]");
  await expect(others.getByRole("heading", { level: 3 })).toHaveCount(3);
  await expect(others.getByRole("link", { name: "Akıllı Kurumsal Filo Kiralama" })).toHaveCount(0);
});

test("a product card lifts under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no pointer to hover with");
  await page.goto("/urunler");
  const card = page.getByRole("main").getByRole("article").nth(1);
  await card.hover();
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).translate)).not.toBe("none");
});

test("the quote page keeps the chosen product in sight, and the choice can be removed", async ({ page }) => {
  await page.goto("/urunler/yesil-filo");
  await page.getByRole("link", { name: "Teklif Al" }).first().click();
  await expect(page).toHaveURL(/kurumsal-teklif\?urun=yesil-filo$/);

  const chip = page.getByRole("region", { name: "Seçtiğiniz ürün" });
  await expect(chip.getByText("Yeşil Filo (Elektrikli & Hibrit Araç Kiralama)")).toBeVisible();
  await expect(chip.getByRole("link", { name: "Ürünü incele" })).toHaveAttribute("href", "/urunler/yesil-filo");
  // The form's own product field is filled too.
  await expect(page.getByLabel(/İlgilendiğiniz ürün/)).toHaveValue("yesil-filo");

  await chip.getByRole("link", { name: "Seçimi kaldır" }).click();
  await expect(page).toHaveURL(/kurumsal-teklif$/);
  await expect(page.getByRole("region", { name: "Seçtiğiniz ürün" })).toHaveCount(0);
});
