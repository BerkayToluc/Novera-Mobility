import { expect, test } from "@playwright/test";

// The footer (SPEC §2.8, after the Framer Simple Footer): an arrow that appears on a link when it is
// pointed at or focused, and blocks that ease into view as the page scrolls to them.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

// The line that grows under a footer link; "0 1" is scaled flat, anything else has grown.
const line = (link: import("@playwright/test").Locator) => link.locator("span.h-px");
const scaleOf = (link: import("@playwright/test").Locator) => line(link).evaluate((el) => getComputedStyle(el).scale);

test("a footer link is named once, and draws its line when focused", async ({ page }) => {
  await page.goto("/hakkimizda");
  const link = page.getByRole("contentinfo").getByRole("link", { name: "Gizlilik Politikası" });
  await link.scrollIntoViewIfNeeded();
  await expect.poll(() => scaleOf(link)).toBe("0 1");
  await link.focus();
  await expect.poll(() => scaleOf(link)).not.toBe("0 1");
  await page.getByRole("contentinfo").getByRole("link", { name: "Kullanım Şartları" }).focus();
  await expect.poll(() => scaleOf(link)).toBe("0 1");
});

test("a footer link waves its letters under the pointer, and the link does not move", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no pointer to hover with");
  await page.goto("/hakkimizda");
  const link = page.getByRole("contentinfo").getByRole("link", { name: "Gizlilik Politikası" });
  await link.scrollIntoViewIfNeeded();
  const before = await link.boundingBox();
  await link.hover();
  await expect(link.locator("[aria-hidden=true] > span").first()).toHaveCSS("animation-name", "wave");
  await expect.poll(() => scaleOf(link)).not.toBe("0 1");
  const after = await link.boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(after!.x).toBe(before!.x);
});

test("the footer's blocks start hidden below the fold and show once the page scrolls to them", async ({ page }) => {
  await page.goto("/hakkimizda");
  const blocks = page.locator("footer [data-kind]");
  await expect(blocks.first()).toHaveAttribute("data-reveal", "hidden");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(blocks.first()).toHaveAttribute("data-reveal", "shown");
  expect(await blocks.evaluateAll((nodes) => nodes.every((node) => (node as HTMLElement).dataset.reveal === "shown"))).toBe(true);
});

test("with reduced motion nothing in the footer is ever hidden", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/hakkimizda");
  await expect(page.locator("footer [data-reveal]")).toHaveCount(0);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Gizlilik Politikası" })).toBeVisible();
});

test("below xl the links come before the brand, from xl the brand is on the left", async ({ page }) => {
  await page.goto("/hakkimizda");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  const nav = await page.getByRole("contentinfo").getByRole("navigation", { name: "Keşfet" }).boundingBox();
  const logo = await page.getByRole("contentinfo").getByRole("link", { name: /ana sayfa/ }).boundingBox();
  expect(nav && logo).toBeTruthy();
  if ((page.viewportSize()?.width ?? 0) >= 1280) expect(logo!.x).toBeLessThan(nav!.x);
  else expect(nav!.y).toBeLessThan(logo!.y);
});

test("the social marks are not links, say they are coming soon, and show their name on focus", async ({ page }) => {
  await page.goto("/hakkimizda");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole("heading", { name: "Bizi takip edin" })).toBeVisible();
  const instagram = footer.getByRole("img", { name: "Instagram · yakında" });
  await expect(instagram).toBeVisible();
  await expect(footer.getByRole("link", { name: /Instagram/ })).toHaveCount(0);
  await expect(footer.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  const tip = instagram.locator("span[aria-hidden=true]");
  await expect(tip).toBeHidden();
  await instagram.focus();
  await expect(tip).toBeVisible();
});

test("the footer's eyes are decorative and keep the pupils inside", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no pointer to follow");
  await page.goto("/hakkimizda");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  const eyes = footer.locator("[data-eye]");
  await expect(eyes).toHaveCount(2);
  await expect(footer.locator("[data-eye]").first().locator("xpath=..")).toHaveAttribute("aria-hidden", "true");
  const box = (await eyes.first().boundingBox())!;
  await page.mouse.move(box.x + box.width + 200, box.y - 100);
  await expect
    .poll(() => footer.locator("[data-pupil]").first().evaluate((el) => (el as HTMLElement).style.transform))
    .toMatch(/translate\(\d/);
});
