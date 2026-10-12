import { expect, test, type Page } from "@playwright/test";

// The home page's moving parts (SPEC §2.2.4, §5.4): nothing that moves starts by itself for long,
// and nothing needs a pause button.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const playState = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => getComputedStyle(element).animationPlayState);

test("the partner strip has no pause button and does not move until it is pointed at or focused", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByRole("group", { name: /İş birliği yaptığımız kurumların logoları/ });
  await strip.scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /Kaydırmayı (durdur|başlat)/ })).toHaveCount(0);

  const track = "section[aria-labelledby=partners-title] [role=group] > div";
  await expect.poll(() => playState(page, track)).toBe("paused");

  // Keyboard focus starts it, and moving focus away leaves it where it stopped.
  await strip.focus();
  await expect.poll(() => playState(page, track)).toBe("running");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expect.poll(() => playState(page, track)).toBe("paused");
});

test("the partner strip starts under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no pointer to hover with");
  await page.goto("/");
  const strip = page.getByRole("group", { name: /İş birliği yaptığımız kurumların logoları/ });
  await strip.scrollIntoViewIfNeeded();
  await strip.hover();
  await expect.poll(() => playState(page, "section[aria-labelledby=partners-title] [role=group] > div")).toBe("running");
});

test("the Road Assurance line runs a trail twice once it is on screen, and not at all with reduced motion", async ({ page }) => {
  await page.goto("/");
  // Two lines exist, one per layout; only the one in use has a box. A path itself is too thin to
  // count as visible, so it is found through its svg.
  const live = page.locator("section[aria-labelledby=guarantee-title] svg:visible path[stroke-linecap=round]");
  await page.locator("section[aria-labelledby=guarantee-title]").scrollIntoViewIfNeeded();
  await expect(live.first()).toHaveCSS("animation-name", "road-trail");
  await expect(live.first()).toHaveCSS("animation-iteration-count", "2");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(live.first()).toHaveCSS("animation-name", "none");
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
    await page.waitForTimeout(300);
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

  // A row closes and opens on its own button, and a closed answer is out of the page.
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
