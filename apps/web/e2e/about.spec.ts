import { expect, test } from "@playwright/test";

// About (SPEC §2.7): the figures count up when they come into view, the sustainability ones too.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the sustainability figures count up to their value, and a screen reader hears the value once", async ({ page }) => {
  await page.goto("/hakkimizda");
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sürdürülebilirlik" }) });
  const counted = section.locator("li").first().locator("[aria-hidden=true]");
  // Below the fold it waits at zero.
  await expect(counted).toHaveText("%0");
  await section.scrollIntoViewIfNeeded();
  await expect(counted).toHaveText("%18");
  await expect(section.locator("li").first().locator(".sr-only")).toHaveText("%18");
});

test("with reduced motion the figures are there from the start", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/hakkimizda");
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sürdürülebilirlik" }) });
  await expect(section.locator("li").first().locator("[aria-hidden=true]")).toHaveText("%18");
});
