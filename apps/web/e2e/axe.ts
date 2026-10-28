import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// WCAG 2.2 AA on the page as it is now (V2-19, QUALITY T-02). Every e2e test runs this on the page it ends on
// (e2e/fixtures.ts), and the sitemap test on every page; a violation fails the test with what and where, so a change
// that breaks contrast, a name, a label or a landmark is caught in CI instead of by a screen reader later.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function expectNoAxeViolations(page: Page, label = page.url()): Promise<void> {
  // Next streams the page title in after the body, so a test that ends right after a navigation can catch the page
  // before it has one ("document-title"); the title is part of the page, so wait for it instead of skipping the rule.
  await page.waitForFunction(() => document.title.length > 0);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    where: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    nodes: violation.nodes.length,
  }));
  expect(summary, `accessibility violations on ${label}`).toEqual([]);
}
