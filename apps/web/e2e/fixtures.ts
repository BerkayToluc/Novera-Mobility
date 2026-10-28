import { expect, test as base } from "@playwright/test";

// Every e2e test fails when a client component did not get its text (V2-15, QUALITY P-01): next-intl logs
// "MISSING_MESSAGE ... Could not resolve `Namespace.key`" and shows the key instead of the words. The page sends only the
// namespaces its client components use (i18n/client-messages.ts), so this is what catches a list that has fallen behind.
const MISSING = /MISSING_MESSAGE|Could not resolve `|INSUFFICIENT_PATH/;

export const test = base.extend<{ missingText: void }>({
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
