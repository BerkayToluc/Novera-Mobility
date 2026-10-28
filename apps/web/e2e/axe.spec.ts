import { expectNoAxeViolations } from "./axe";
import { expect, test } from "./fixtures";

// V2-19 (QUALITY T-02): the accessibility check really turns a test red. The page is broken on purpose (pale grey text on
// white), so this test switches the automatic check off for itself and asserts the helper rejects.
test.use({ axe: false });

test("a deliberately broken contrast fails the accessibility check, and the page as built passes it", async ({ page }) => {
  await page.goto("/hakkimizda");
  await expectNoAxeViolations(page);

  await page.addStyleTag({ content: "body, body * { color: #c8c8c8 !important; background: #ffffff !important; }" });
  await expect(expectNoAxeViolations(page)).rejects.toThrow(/color-contrast/);
});
