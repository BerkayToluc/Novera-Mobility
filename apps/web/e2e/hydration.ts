import { expect, type Locator } from "@playwright/test";

// A server-rendered page can be clicked before React has hydrated it, and then nothing happens: the handlers
// are not attached yet, so a hover or click is lost for good (the menu never opens, the bubble stays shut).
// It showed as tests that passed alone and failed now and then in the whole suite, on busy machines (CI).
// React marks a DOM node with `__reactProps$…` when it hydrates it, so interacting waits for that mark first.
// Pass a locator for one element; the same locator is returned, so `await (await hydrated(button)).click()` reads fine,
// or call it on its own line before the click.
export async function hydrated(locator: Locator): Promise<Locator> {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$"))), {
      message: "the element was never hydrated by React",
    })
    .toBe(true);
  return locator;
}
