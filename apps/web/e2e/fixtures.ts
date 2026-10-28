import { expect, test as base } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

// Every e2e test fails when a client component did not get its text (V2-15, QUALITY P-01): next-intl logs
// "MISSING_MESSAGE ... Could not resolve `Namespace.key`" and shows the key instead of the words. The page sends only the
// namespaces its client components use (i18n/client-messages.ts), so this is what catches a list that has fallen behind.
const MISSING = /MISSING_MESSAGE|Could not resolve `|INSUFFICIENT_PATH/;

// `axe` is on for every test (V2-19, QUALITY T-02): when the test is over and has not failed, the page it ended on is
// checked against WCAG 2.2 AA. A test that ends on something that is not a page of this site (a download, an
// external address) or deliberately leaves a known problem on screen turns it off with `test.use({ axe: false })`.
export const test = base.extend<{ missingText: void; axe: boolean; accessibility: void }>({
  axe: [true, { option: true }],
  accessibility: [
    async ({ page, axe }, use, testInfo) => {
      await use();
      if (!axe || testInfo.status !== testInfo.expectedStatus) return;
      if (page.isClosed() || !page.url().startsWith("http://localhost")) return;
      await expectNoAxeViolations(page);
    },
    { auto: true },
  ],
  missingText: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && MISSING.test(message.text())) problems.push(message.text());
      });
      page.on("pageerror", (error) => {
        if (MISSING.test(error.message)) problems.push(error.message);
      });
      await use();
      expect(problems, "a client component is missing its text").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
