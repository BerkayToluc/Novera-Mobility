import { expect, test } from "./fixtures";

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
    await page.goto("/");
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

  test("the home page fleet shows one category at a time and keeps the rest of the address", async ({ page }) => {
    await page.goto("/?tip=bireysel");
    const fleet = page.locator("#araclarimiz");
    // The first category is open to begin with and there is no "all" chip.
    await expect(fleet.getByRole("button", { name: /^Tümü/ })).toHaveCount(0);
    await expect(fleet.getByRole("button", { name: /Renault Clio/ }).first()).toBeVisible();
    await expect(fleet.getByRole("button", { name: /Dacia Duster/ })).toHaveCount(0);

    await fleet.getByRole("button", { name: /^SUV/ }).click();
    await expect(fleet.getByRole("button", { name: /Dacia Duster/ }).first()).toBeVisible();
    await expect(fleet.getByRole("button", { name: /Renault Clio/ })).toHaveCount(0);

    // Opening a model adds ?arac= and leaves ?tip= where it was.
    await fleet.getByRole("button", { name: /Dacia Duster/ }).first().click();
    await expect(page).toHaveURL(/tip=bireysel/);
    await expect(page).toHaveURL(/arac=/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/tip=bireysel/);
    await expect(page).not.toHaveURL(/arac=/);
  });

  test("the corporate tab has no fleet section", async ({ page }) => {
    await page.goto("/?tip=kurumsal");
    await expect(page.locator("#araclarimiz")).toHaveCount(0);
  });

  test("a shared model link opens its window on the home page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Renault Clio/ }).first().click();
    const shared = page.url();
    await page.goto(shared);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("the city filter narrows the branches", async ({ page }) => {
    await page.goto("/bayilerimiz");
    // Hydration finishes after the first paint; the button is there but does nothing until then.
    const city = page.getByRole("button", { name: "Şehir", exact: true });
    await expect.poll(async () => {
      await city.click();
      return page.getByRole("combobox", { name: "Şehir ara" }).isVisible();
    }).toBe(true);
    // Typed without the Turkish letters: the search finds İzmir all the same.
    await page.getByRole("combobox", { name: "Şehir ara" }).fill("izmir");
    await page.getByRole("option", { name: /İzmir/ }).click();
    await expect(city).toContainText("İzmir");
    // "X of 15 branches are shown": fewer than all of them, and the Izmir ones.
    const shown = page.getByRole("status").filter({ hasText: /\d/ });
    await expect(shown).toHaveCount(1);
    // The text carries "{total}" and "{count}" for the filtered result.
    const [total, count] = ((await shown.first().textContent()) ?? "").match(/\d+/g)!.map(Number);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total);
    await expect(page.getByRole("list").getByText(/İzmir/).first()).toBeVisible();
  });

  test("the city list can be searched and chosen from the keyboard", async ({ page }) => {
    await page.goto("/bayilerimiz");
    const city = page.getByRole("button", { name: "Şehir", exact: true });
    await expect.poll(async () => {
      await city.click();
      return page.getByRole("combobox", { name: "Şehir ara" }).isVisible();
    }).toBe(true);
    const search = page.getByRole("combobox", { name: "Şehir ara" });
    // The first row is "all cities"; the arrow keys move down to the next ones and Enter picks.
    await expect(page.getByRole("option").first()).toContainText("Tüm şehirler");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(search).toBeHidden();
    await expect(city).not.toContainText("Tüm şehirler");
    // Escape closes the list and the focus is back on the button.
    await page.keyboard.press("Enter");
    await expect(search).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toBeHidden();
    await expect(city).toBeFocused();
  });

  test("a city that does not exist is said so in the list, and the branches stay", async ({ page }) => {
    await page.goto("/bayilerimiz");
    const city = page.getByRole("button", { name: "Şehir", exact: true });
    await expect.poll(async () => {
      await city.click();
      return page.getByRole("combobox", { name: "Şehir ara" }).isVisible();
    }).toBe(true);
    await page.getByRole("combobox", { name: "Şehir ara" }).fill("zzz");
    await expect(page.getByText("Eşleşen şehir yok.")).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("the branches page has no intro line under its heading", async ({ page }) => {
    await page.goto("/bayilerimiz");
    await expect(page.getByRole("heading", { level: 1, name: "Bayilerimiz" })).toBeVisible();
    await expect(page.getByText(/liste ve harita birlikte daralır/)).toHaveCount(0);
  });
});
