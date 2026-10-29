import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The panel's frame (V2-24, docs/ADMIN.md §2, §3, DESIGN.md §8): who gets in, where the others go, the menu at every width,
// and that nothing of it is offered to a search engine.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("a visitor who is not signed in is sent to the sign-in page and brought back to the panel", async ({ page }) => {
  await page.goto("/yonetim");
  await expect(page).toHaveURL(/\/giris\?sonra=yonetim$/);
  // An administrator cannot use Google, so the button is not offered on this way in.
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);

  await page.getByLabel("E-posta").fill("yonetici@novera.example");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234-uzun");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByRole("heading", { level: 1, name: "Yönetim paneli" })).toBeVisible();
});

test("a customer finds no panel: the page does not exist", async ({ page, context }) => {
  await signInSample(context, "individual");
  const response = await page.goto("/yonetim");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: /bulunamadı|404|Sayfa/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel bölümleri" })).toHaveCount(0);
});

test("an administrator gets in, and the page is not indexed", async ({ page, context }) => {
  await signInSample(context, "admin");
  const response = await page.goto("/yonetim");
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /nofollow/);
});

test("the panel is in neither the sitemap nor llms.txt", async ({ request }) => {
  for (const path of ["/sitemap.xml", "/llms.txt"]) {
    const body = await (await request.get(path)).text();
    expect(body, path).not.toMatch(/yonetim|\/admin/);
  }
});

test("desktop: the menu is a column on the left with the summary marked", async ({ page, context }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "the column is the xl layout");
  await signInSample(context, "admin");
  await page.goto("/yonetim");
  const nav = page.getByRole("navigation", { name: "Panel bölümleri" });
  await expect(nav.getByRole("link", { name: "Özet" })).toHaveAttribute("aria-current", "page");
  // The button that opens the list is for the narrow layouts only.
  await expect(nav.getByRole("button")).toBeHidden();
  // Screens that do not exist yet are not in the menu: the summary, the campaign codes (V2-26) and the branches (V2-27) are.
  await expect(nav.getByRole("link")).toHaveCount(3);
  await expect(nav.getByRole("link", { name: "Kampanya kodları" })).toBeVisible();
});

test("narrow: the menu is one button that opens the list, and Escape closes it and gives the focus back", async ({ page, context }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1280, "below xl the list is behind a button");
  await signInSample(context, "admin");
  await page.goto("/yonetim");
  const nav = page.getByRole("navigation", { name: "Panel bölümleri" });
  const button = nav.getByRole("button", { name: "Menü: Özet" });
  await hydrated(button);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Özet" })).toBeHidden();

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Özet" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

test("no horizontal scroll at 375, 768 and 1280", async ({ page, context }) => {
  await signInSample(context, "admin");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/yonetim");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
});

test("English: /en/admin, with the menu and the page in English", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin panel" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel sections" })).toBeVisible();
});
