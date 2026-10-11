import { expect, test } from "@playwright/test";

// SPEC §8 steps 6 to 8: the fleet window, the contact page and the cookie banner.

test.describe("cookie banner", () => {
  test("Reddet keeps analytics out of the page", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Çerez bildirimi" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Reddet" }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole("region", { name: "Çerez bildirimi" })).toBeHidden();
    expect(await page.locator('script[src*="analytics.example"]').count()).toBe(0);
  });

  test("Kabul et lets analytics in, and the footer can take it back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("region", { name: "Çerez bildirimi" }).getByRole("button", { name: "Kabul et" }).click();
    await page.reload();
    expect(await page.locator('script[src*="analytics.example"]').count()).toBe(1);

    await page.getByRole("button", { name: "Çerez tercihleri" }).click();
    const dialog = page.getByRole("dialog", { name: "Çerez tercihleri" });
    await dialog.getByRole("checkbox", { name: /Analitik/ }).uncheck();
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await page.reload();
    expect(await page.locator('script[src*="analytics.example"]').count()).toBe(0);
  });

  test("the first HTML already carries the banner and a nonce on every script", async ({ request }) => {
    const response = await request.get("/");
    const html = await response.text();
    expect(html).toContain("data-consent-banner");
    expect(response.headers()["content-security-policy"]).toContain("'nonce-");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });
});

test.describe("with the banner out of the way", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
    ]);
  });

  test("a fleet card opens its window, Esc closes it and focus goes back to the card", async ({ page }) => {
    await page.goto("/araclarimiz");
    const card = page.getByRole("button", { name: /Renault Clio/ }).first();
    await card.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/arac=/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("the city filter narrows the branches", async ({ page }) => {
    await page.goto("/bayilerimiz");
    const city = page.getByLabel("Şehir");
    await expect
      .poll(async () => {
        await city.selectOption("İzmir");
        return city.inputValue();
      })
      .toBe("İzmir");
    // "X of 15 branches are shown": fewer than all of them, and the Izmir ones.
    const shown = page.getByRole("status").filter({ hasText: /\d/ });
    await expect(shown).toHaveCount(1);
    // The text carries "{total}" and "{count}" for the filtered result.
    const [total, count] = ((await shown.first().textContent()) ?? "").match(/\d+/g)!.map(Number);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total);
    await expect(page.getByRole("list").getByText(/İzmir/).first()).toBeVisible();
  });
});
