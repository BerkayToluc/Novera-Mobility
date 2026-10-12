import { expect, test } from "@playwright/test";

// The header (SPEC §2.8): the floating pill, links that sit together, only Products opening a list,
// a language menu with flags, no theme control, an icon for a signed-in account.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("desktop: Products opens a list, Services is a plain link", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "the inline menu is the desktop layout");
  await page.goto("/");
  const header = page.getByRole("banner");

  await header.getByRole("button", { name: "Ürünler" }).click();
  await expect(page.getByRole("link", { name: "Tüm ürünler" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Tüm ürünler" })).toHaveCount(0);

  // Services keeps no list: one link, to its own page.
  await expect(header.getByRole("button", { name: "Hizmetler" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Hizmetler" })).toHaveAttribute("href", "/hizmetler");
});

test("desktop: the language menu lists both languages and switches", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "the inline menu is the desktop layout");
  await page.goto("/");
  const header = page.getByRole("banner");

  await header.getByRole("button", { name: "Dil: Türkçe" }).click();
  await expect(page.getByRole("link", { name: "Türkçe" })).toHaveAttribute("aria-current", "true");
  // Each language has its flag beside the name.
  await expect(page.getByRole("link", { name: "English" }).locator("svg")).toHaveCount(1);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the header has no theme control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByText(/^(Tema|Theme)$/)).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("button", { name: /tema|theme/i })).toHaveCount(0);
});

test("a visitor sees Giriş Yap and a signed-in account sees an icon named Hesabım", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Giriş Yap" })).toBeVisible();

  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  // The visible word "Hesabım" is gone; the link keeps it as its name.
  const account = header.getByRole("link", { name: "Hesabım" });
  await expect(account).toBeVisible();
  await expect(account.getByText("Hesabım")).toHaveCount(0);
});

test("phone: the menu panel has Services as a link and no theme", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1280, "the panel is the phone and tablet layout");
  await page.goto("/");
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  const panel = page.getByRole("dialog", { name: "Menü" });
  await expect(panel.getByRole("link", { name: "Hizmetler" })).toBeVisible();
  await expect(panel.getByText(/^Tema$/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
