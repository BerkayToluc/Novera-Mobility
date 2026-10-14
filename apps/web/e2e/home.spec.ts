import { expect, test, type Page } from "@playwright/test";

// The home page's moving parts (SPEC §2.2.4, §5.4): nothing that moves starts by itself for long,
// and nothing needs a pause button.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});


const logoX = (page: Page) =>
  page.locator("section[aria-labelledby=partners-title] [data-logo]").first().evaluate((element) => (element as HTMLElement).style.transform);

test("the partner strip turns by itself, has no pause button, and stops when focus is inside it", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByRole("group", { name: /İş birliği yaptığımız kurumların logoları/ });
  await strip.scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /Kaydırmayı (durdur|başlat)/ })).toHaveCount(0);
  // The names are read once: eight partners, the loop's copies hidden.
  await expect(strip.getByRole("listitem")).toHaveCount(8);

  const before = await logoX(page);
  await expect.poll(() => logoX(page)).not.toBe(before);

  // Focus eases it to a stop: two readings a moment apart are the same.
  await strip.focus();
  await page.waitForTimeout(1500);
  const held = await logoX(page);
  await page.waitForTimeout(300);
  expect(await logoX(page)).toBe(held);

  // Focus leaving lets it turn again.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expect.poll(() => logoX(page)).not.toBe(held);
});

test("the partner strip stops under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no pointer to hover with");
  await page.goto("/");
  const strip = page.getByRole("group", { name: /İş birliği yaptığımız kurumların logoları/ });
  await strip.scrollIntoViewIfNeeded();
  await strip.hover();
  await page.waitForTimeout(1500);
  const held = await logoX(page);
  await page.waitForTimeout(300);
  expect(await logoX(page)).toBe(held);
});

test("with reduced motion the partner strip stands still and the steps show complete", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const strip = page.getByRole("group", { name: /İş birliği yaptığımız kurumların logoları/ });
  await strip.scrollIntoViewIfNeeded();
  const first = await logoX(page);
  await page.waitForTimeout(500);
  expect(await logoX(page)).toBe(first);
  await expect(page.locator("[data-steps][data-armed]")).toHaveCount(0);
});

test("the Road Assurance steps start unfilled and fill once the band is on screen", async ({ page }) => {
  await page.goto("/");
  const steps = page.locator("section[aria-labelledby=guarantee-title] [data-steps]");
  await expect(steps).toHaveAttribute("data-armed", "");
  await steps.scrollIntoViewIfNeeded();
  await expect(steps).not.toHaveAttribute("data-armed", "");
  await expect(steps.getByRole("listitem")).toHaveCount(5);
});

test("the gallery's arrows sit on the card's left and right edge and move the slides", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("region", { name: /Kampanyalar/ }).first();
  const next = page.getByRole("button", { name: "Sonraki kampanya" });
  const art = page.getByRole("group", { name: "1 / 3" });
  const previous = page.getByRole("button", { name: "Önceki kampanya" });
  const nextBox = (await next.boundingBox())!;
  const previousBox = (await previous.boundingBox())!;
  const slide = (await art.boundingBox())!;
  // The left band is on the card's own left edge, the right one on its right edge, both the full
  // height of the picture (the top of the card on a phone).
  expect(Math.abs(previousBox.x - slide.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(nextBox.x + nextBox.width - (slide.x + slide.width))).toBeLessThanOrEqual(1);
  expect(previousBox.height).toBeGreaterThan(100);
  expect(nextBox.height).toBeGreaterThan(100);
  await gallery.hover();
  await next.click();
  await expect(page.getByRole("button", { name: "2. kampanyaya git" })).toHaveAttribute("aria-current", "true");
});

test("the guides slide with an arrow at each side, and there is no all-guides button", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=guides-title]");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("link", { name: "Tüm rehberler" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Tüm rehberler" })).toHaveCount(0);
  // All six guides are in the strip, not only the three that fit.
  await expect(section.getByRole("heading", { level: 3 })).toHaveCount(6);

  const strip = section.locator("ul").first();
  const previous = section.getByRole("button", { name: "Önceki rehberler" });
  const next = section.getByRole("button", { name: "Sonraki rehberler" });
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  await expect(next).toHaveAttribute("aria-disabled", "false");

  await next.click();
  await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(previous).toHaveAttribute("aria-disabled", "false");

  // Pressing next on and on reaches the last guide, where it is marked unavailable.
  for (let step = 0; step < 6; step++) {
    if ((await next.getAttribute("aria-disabled")) === "true") break;
    await next.click();
    await page.waitForTimeout(1000);
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
});

test("the store buttons carry the Apple and Google Play marks, centred, and are not links", async ({ page }) => {
  await page.goto("/");
  const app = page.locator("section", { has: page.getByRole("heading", { name: "Novera cebinizde" }) });
  await app.scrollIntoViewIfNeeded();
  const badges = app.locator("li", { hasText: /App Store|Google Play/ });
  await expect(badges).toHaveCount(2);
  for (const badge of await badges.all()) {
    await expect(badge.locator("svg")).toHaveCount(1);
    await expect(badge.getByRole("link")).toHaveCount(0);
  }
  // Centred: the pair's middle is the middle of the column that holds it.
  const [first, second] = [await badges.nth(0).boundingBox(), await badges.nth(1).boundingBox()];
  const column = await app.locator("li", { hasText: /App Store/ }).locator("xpath=ancestor::div[1]").boundingBox();
  expect(first && second && column).toBeTruthy();
  const pairMiddle = (first!.x + second!.x + second!.width) / 2;
  const columnMiddle = column!.x + column!.width / 2;
  expect(Math.abs(pairMiddle - columnMiddle)).toBeLessThan(4);
});

test("the FAQ has a tab for each topic, rows that open and close, and follows the rental box's audience", async ({ page }) => {
  await page.goto("/");
  const faq = page.locator("section[aria-labelledby=faq-title]");
  await faq.scrollIntoViewIfNeeded();

  // The first topic is chosen and its first row is open.
  const topics = faq.getByRole("group", { name: "Konular" });
  await expect(topics.getByRole("button", { name: "Rezervasyon" })).toHaveAttribute("aria-pressed", "true");
  const first = faq.getByRole("button", { name: /Rezervasyonu iptal edebilir miyim/ });
  await expect(first).toHaveAttribute("aria-expanded", "true");

  // Opening another row closes the first: one answer at a time.
  const second = faq.getByRole("button", { name: /Rezervasyonu iptal edebilir miyim/ }).locator("xpath=ancestor::li/following-sibling::li[1]//button");
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await second.click();

  // A row closes and opens on its own button, and a closed answer is out of the page.
  await first.click();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(faq.getByText(/24 saat öncesine kadar ücretsiz iptal/)).toHaveCount(0);
  await first.click();
  await expect(faq.getByText(/24 saat öncesine kadar ücretsiz iptal/)).toBeVisible();

  // Another topic shows its own questions.
  await topics.getByRole("button", { name: "Ödeme" }).click();
  await expect(topics.getByRole("button", { name: "Ödeme" })).toHaveAttribute("aria-pressed", "true");
  await expect(faq.getByRole("button", { name: /Gösterilen fiyatlara KDV dahil mi/ })).toBeVisible();
  await expect(first).toHaveCount(0);

  // The corporate tab of the rental box brings the corporate questions.
  await page.goto("/?tip=kurumsal");
  const corporate = page.locator("section[aria-labelledby=faq-title]");
  await expect(corporate.getByRole("button", { name: /En az kaç araç için teklif alabilirim/ })).toBeVisible();
  await expect(corporate.getByRole("button", { name: /Rezervasyonu iptal edebilir miyim/ })).toHaveCount(0);
});

test("Use my location picks the nearest branch and says how far it is", async ({ page, context }) => {
  // Moda, a couple of kilometres from the Kadıköy branch.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 40.98, longitude: 29.03 });
  await page.goto("/");
  await page.getByRole("button", { name: "Konumumu kullan" }).click();

  await expect(page.getByRole("combobox", { name: "Alış bayisi" })).toContainText("İstanbul · Kadıköy");
  // The return branch follows, as it does for a hand-picked pick-up.
  await expect(page.getByRole("combobox", { name: "Bırakacağınız bayi" })).toContainText("İstanbul · Kadıköy");
  await expect(page.locator("#kiralama").getByRole("status")).toContainText(/En yakın bayi seçildi: İstanbul · Kadıköy, yaklaşık \d+ km/);
});

test("Use my location says so when the position is refused, and leaves the branch to the list", async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto("/");
  await page.getByRole("button", { name: "Konumumu kullan" }).click();
  await expect(page.locator("#kiralama").getByRole("status")).toContainText(/Konum izni verilmedi|Konumunuz alınamadı/);
  await expect(page.getByRole("combobox", { name: "Alış bayisi" })).toContainText("Bayi seçin");
});

test("the how-it-works steps are on the Individual tab and not on the Corporate one", async ({ page }) => {
  await page.goto("/");
  const steps = page.locator("section[aria-labelledby=how-title]");
  await expect(steps.getByRole("heading", { level: 2, name: "Nasıl çalışır?" })).toBeVisible();
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await page.goto("/?tip=kurumsal");
  await expect(page.locator("section[aria-labelledby=how-title]")).toHaveCount(0);
});
