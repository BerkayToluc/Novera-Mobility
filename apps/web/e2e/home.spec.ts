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
