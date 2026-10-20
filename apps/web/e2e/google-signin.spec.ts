import { expect, test, type Page } from "@playwright/test";

// Google sign-in (individual accounts only). With sample data the button is a stand-in that needs no Google; the
// novera-mock-google cookie plays the API's other answers (lib/session.ts), so every path can be walked.
const BASE = "http://localhost:3200";

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: BASE },
  ]);
});

const hook = (page: Page, value: string) =>
  page.context().addCookies([{ name: "novera-mock-google", value, url: BASE }]);

const google = (page: Page) => page.getByRole("button", { name: "Google ile devam et (deneme)" });

test("the Google button is on the individual sign-in and on sign-up, and not on the corporate tab", async ({ page }) => {
  await page.goto("/giris");
  await expect(google(page)).toBeVisible();
  await page.goto("/kayit");
  await expect(google(page)).toBeVisible();
  await page.goto("/giris?tip=kurumsal");
  await expect(page.getByRole("heading", { level: 1, name: "Kurumsal Giriş" })).toBeVisible();
  await expect(google(page)).toHaveCount(0);
});

test("an account that exists signs in with one click", async ({ page }) => {
  await page.goto("/giris");
  await google(page).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByRole("heading", { level: 1, name: /Hoş geldin/ })).toBeVisible();
});

test("a new Google account asks for the consent, then opens, and sets its password through the reset link", async ({ page }) => {
  await hook(page, "new");
  await page.goto("/kayit");
  await google(page).click();

  // Nothing is opened yet: the consent comes first.
  await expect(page.getByText("Bu Google hesabıyla henüz bir Novera hesabınız yok.")).toBeVisible();
  await expect(page).toHaveURL(/\/kayit$/);
  const step = page.getByRole("group", { name: /henüz bir Novera hesabınız yok/ });
  await step.getByRole("button", { name: "Devam et" }).click();
  await expect(step.getByText("Devam etmek için aydınlatma metnini kabul etmelisiniz.")).toBeVisible();
  await step.getByRole("checkbox").check();
  await step.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/profil$/);

  // The account has no password: the security section offers to set one instead of changing it.
  await page.goto("/profil/ayarlar");
  await expect(page.getByRole("heading", { name: "Şifre belirle" })).toBeVisible();
  await expect(page.getByLabel("Mevcut şifre")).toHaveCount(0);
  await page.getByRole("button", { name: "Şifre belirleme bağlantısı gönder" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bağlantıyı ece.aydin@example.com adresine gönderdik." })).toBeVisible();
});

test("the consent step can be cancelled and the button comes back", async ({ page }) => {
  await hook(page, "new");
  await page.goto("/giris");
  await google(page).click();
  await expect(page.getByRole("button", { name: "Devam et" })).toBeVisible();
  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(google(page)).toBeVisible();
});

for (const [answer, message] of [
  ["corporate", "Kurumsal hesaplar Google ile giriş yapamaz."],
  ["invalid", "Google girişi doğrulanamadı."],
  ["limit", "Çok fazla deneme yaptınız."],
  ["down", "Google ile giriş şu an kullanılamıyor."],
] as const) {
  test(`the ${answer} answer is told in its own words`, async ({ page }) => {
    await hook(page, answer);
    await page.goto("/giris");
    await google(page).click();
    await expect(page.locator("#main").getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page).toHaveURL(/\/giris$/);
  });
}

test("an account with a password still changes it the usual way", async ({ page }) => {
  await page.goto("/giris");
  await google(page).click();
  await expect(page).toHaveURL(/\/profil$/);
  await page.goto("/profil/ayarlar");
  await expect(page.getByLabel("Mevcut şifre")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Şifre belirle" })).toHaveCount(0);
});
