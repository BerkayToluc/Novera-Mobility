import { expect, test } from "@playwright/test";

// SPEC §8 steps 5 and 7 (the forms), and the account: signing in on each tab, the pages that
// belong to each, and the preferences that come back at the next sign-in.

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the contact form sends and shows its reference", async ({ page }) => {
  await page.goto("/iletisim");
  await page.getByLabel("Ad soyad").fill("Elif Yıldız");
  await page.getByLabel(/^E-posta/).fill("elif@example.com");
  await page.getByLabel("Mesajınız").fill("Merhaba, bir sorum var, yardımcı olur musunuz?");
  await page.getByRole("checkbox", { name: /aydınlatma|KVKK/i }).check();
  await page.getByRole("button", { name: "Mesajı Gönder" }).click();
  await expect(page.getByRole("heading", { name: "Mesajınız alındı" })).toBeVisible();
});

test("the contact form names what is missing and does not send", async ({ page }) => {
  await page.goto("/iletisim");
  await page.getByRole("button", { name: "Mesajı Gönder" }).click();
  await expect(page.getByText("Adınızı ve soyadınızı yazın.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mesajınız alındı" })).toHaveCount(0);
});

test("the corporate quote form sends", async ({ page }) => {
  await page.goto("/kurumsal-teklif");
  await page.getByLabel("Firma adı").fill("Ege Lojistik");
  await page.getByLabel("Yetkili ad soyad").fill("Mert Kaya");
  await page.getByLabel("İş e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Telefon").fill("0232 555 01 00");
  await // The choices are chips: the checkbox itself is hidden and its label is what is clicked.
  await page.getByText("SUV", { exact: true }).click();
  await page.getByLabel("Teslim şehirleri").fill("İzmir");
  await page.getByRole("checkbox", { name: /aydınlatma|KVKK/i }).check();
  await page.getByRole("button", { name: "Teklif İste" }).click();
  await expect(page.getByRole("heading", { name: "Talebiniz alındı" })).toBeVisible();
});

test("a visitor who is not signed in is asked to sign in", async ({ page }) => {
  await page.goto("/profil");
  await expect(page.getByRole("heading", { name: "Giriş yapmanız gerekiyor" })).toBeVisible();
});

test("the corporate tab signs in to the company pages", async ({ page }) => {
  await page.goto("/giris?tip=kurumsal");
  await expect(page.getByRole("heading", { level: 1, name: "Kurumsal Giriş" })).toBeVisible();
  // A corporate account is opened by Novera, so there is no sign-up link on this tab.
  await expect(page.getByRole("link", { name: "Kayıt Ol" })).toHaveCount(0);

  await page.getByLabel("Firma e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();

  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByText("Ege Lojistik A.Ş.")).toBeVisible();
  await page.getByRole("link", { name: "Teklif taleplerim" }).click();
  await expect(page.getByText("NVK-2026-48213")).toBeVisible();
  // An individual's pages are not here.
  await expect(page.getByRole("link", { name: "Puanlarım" })).toHaveCount(0);

  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL("http://localhost:3200/");
  await page.goto("/profil");
  await expect(page.getByRole("heading", { name: "Giriş yapmanız gerekiyor" })).toBeVisible();
});

test("an individual sees upcoming and past trips and points", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);

  await page.getByRole("link", { name: "Rezervasyonlarım" }).click();
  await expect(page.getByRole("heading", { name: "Yaklaşan seyahatler" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Geçmiş seyahatler" })).toBeVisible();

  await page.getByRole("link", { name: "Puanlarım" }).click();
  await expect(page.getByText("Puan bakiyesi")).toBeVisible();
  await expect(page.getByText("Her ₺100 harcamanız için 1 puan")).toBeVisible();
});

test("saved preferences come back at the next sign-in", async ({ page }) => {
  const signIn = async () => {
    await page.goto("/giris");
    await page.getByLabel("E-posta").fill("elif@example.com");
    await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/(en\/profile|profil)$/);
  };
  await signIn();
  await page.goto("/profil/ayarlar");
  await page.getByRole("group", { name: "Dil" }).getByText("English").click();
  await page.getByRole("group", { name: "Görünüm" }).getByText("Koyu").click();
  await page.getByRole("group", { name: "Para birimi" }).getByText("EUR").click();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page).toHaveURL(/\/en\/profile\/settings/);

  // Another device: this browser forgets its own choices. Only the account remembers them (the
  // sample account keeps them in a cookie of its own that survives, as a database row would).
  const context = page.context();
  const keep = (await context.cookies()).filter((c) => ["novera-consent", "novera-mock-prefs"].includes(c.name));
  await context.clearCookies();
  await context.addCookies(keep);
  await signIn();

  // Signing in brought the saved language, theme and currency back.
  await expect(page).toHaveURL(/\/en\/profile$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "novera-currency")?.value).toBe("EUR");
});
