import { expect, test } from "@playwright/test";
import { hydrated } from "./hydration";

// The helper that keeps the other specs from clicking before React has hydrated the page. The page's scripts
// arrive 2.5 s late, as on a busy machine; a click made at once would be lost (the bubble would never open),
// and `hydrated()` makes the test wait until the button really works.
test("hydrated() waits for slow scripts, so the click is not lost", async ({ page, context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto("/iletisim", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("button", { name: "iletisim@novera.example" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await hydrated(trigger);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});
