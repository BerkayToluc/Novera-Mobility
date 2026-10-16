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
  await page.getByRole("combobox", { name: "Teslim şehirleri" }).fill("izm");
  await page.getByRole("listbox", { name: "Teslim şehirleri" }).getByRole("option", { name: "İzmir" }).click();
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
  await expect(page.getByRole("heading", { level: 1, name: /Ege Lojistik/ })).toBeVisible();
  await page.getByRole("link", { name: "Teklif taleplerim" }).click();
  await expect(page.getByText("TKL-2026-48213")).toBeVisible();
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

  const nav = page.getByRole("navigation", { name: "Profil bölümleri" });
  await nav.getByRole("link", { name: "Rezervasyonlarım" }).click();
  await expect(page.getByRole("heading", { name: "Yaklaşan seyahatler" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Geçmiş seyahatler" })).toBeVisible();

  await nav.getByRole("link", { name: "Puanlarım" }).click();
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
  await page.getByRole("region", { name: "Varsayılan tercihlerim" }).getByRole("button", { name: "Kaydet" }).click();
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

const fillSignUp = async (page: import("@playwright/test").Page) => {
  await page.getByLabel("Ad", { exact: true }).fill("Elif");
  await page.getByLabel("Soyad").fill("Yıldız");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("uzun-bir-sifre-1");
  await page.getByRole("checkbox", { name: /KVKK/ }).check();
  await page.getByRole("button", { name: "Kayıt Ol" }).click();
};

test("signing up opens the account", async ({ page }) => {
  await page.goto("/kayit");
  await fillSignUp(page);
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hoş geldin, Elif" })).toBeVisible();
});

test("signing up from the payment page goes back to the booking, and only to it", async ({ page }) => {
  const booking =
    "alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00&arac=renault-clio-istanbul-kadikoy";
  // The hold is made the way a visitor makes it, so the payment page it returns to is a live one.
  await page.goto(`/araclar?${booking.replace("&arac=renault-clio-istanbul-kadikoy", "")}`);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/tutma=/);
  const query = new URL(page.url()).search.slice(1);

  await page.goto(`/giris?sonra=odeme&${query}`);
  await page.getByRole("link", { name: "Kayıt Ol" }).click();
  await expect(page).toHaveURL(/\/kayit\?sonra=odeme/);
  await fillSignUp(page);
  await expect(page).toHaveURL(/\/odeme\?.*tutma=/);
  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();

  // An address that is not a booking is ignored: it ends up on the profile, not on a page of its choosing.
  await page.context().clearCookies();
  await page.context().addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await page.goto("/kayit?sonra=https://example.org");
  await fillSignUp(page);
  await expect(page).toHaveURL(/\/profil$/);
});

test("the contact page points to the help centre, with the branches one small link away", async ({ page }) => {
  await page.goto("/iletisim");
  const help = page.locator("section[aria-labelledby=help-link-title]");
  await expect(help.getByRole("heading", { name: "Yardım merkezi" })).toBeVisible();
  await expect(help.getByRole("link", { name: "Yardım merkezine git" })).toHaveAttribute("href", "/yardim");
  await expect(help.getByRole("link", { name: "Bayilerimiz" })).toHaveAttribute("href", "/bayilerimiz");
  await expect(page.getByText("Size en yakın bayi", { exact: true })).toHaveCount(0);
});

test("the profile greets the person, shows the points and the next trip, and has quick actions", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);

  await expect(page.getByRole("heading", { level: 1, name: "Hoş geldin, Elif" })).toBeVisible();
  // The points chip says what the points are worth (one point is five lira) and opens the points page.
  const chip = page.getByRole("link", { name: /puan · ₺/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("href", "/profil/puanlar");

  const next = page.locator("section[aria-labelledby=next-trip]");
  await expect(next.getByText("Sıradaki seyahatiniz")).toBeVisible();
  await expect(next.getByRole("heading", { name: /Renault Clio/ })).toBeVisible();
  await expect(next.getByText(/gün kaldı|Bugün başlıyor/)).toBeVisible();

  const quick = page.locator("section[aria-labelledby=quick-title]");
  await expect(quick.getByRole("link", { name: /Yeni kiralama/ })).toBeVisible();
  await expect(quick.getByRole("link", { name: /Yardım merkezi/ })).toHaveAttribute("href", "/yardim");
  // The name form is still there.
  await expect(page.getByLabel("Ad", { exact: true })).toBeVisible();
});

test("the profile's links carry an icon each, and the current page is marked", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  const nav = page.getByRole("navigation", { name: "Profil bölümleri" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Hesabım" })).toHaveAttribute("aria-current", "page");
  for (const link of await nav.getByRole("link").all()) await expect(link.locator("svg")).toHaveCount(1);
});

test("a new password can be set from the link in the e-mail", async ({ page }) => {
  await page.goto("/sifre-sifirla/yeni?token=abc123");
  await page.getByLabel("Yeni şifre").fill("kisa");
  await page.getByRole("button", { name: "Şifreyi Kaydet" }).click();
  await expect(page.getByText("Şifre en az 8 karakter olmalıdır.")).toBeVisible();

  await page.getByLabel("Yeni şifre").fill("yeni-uzun-sifre-1");
  await page.getByRole("button", { name: "Şifreyi Kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Şifreniz değişti");
  await page.locator("#main").getByRole("link", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
});

test("a reset link that is missing or no longer works asks for a new one", async ({ page }) => {
  for (const address of ["/sifre-sifirla/yeni", "/sifre-sifirla/yeni?token=expired"]) {
    await page.goto(address);
    if (address.endsWith("expired")) {
      await page.getByLabel("Yeni şifre").fill("yeni-uzun-sifre-1");
      await page.getByRole("button", { name: "Şifreyi Kaydet" }).click();
    }
    await expect(page.locator("#main").getByRole("alert")).toContainText("geçersiz");
    await page.getByRole("link", { name: "Yeni bağlantı iste" }).click();
    await expect(page).toHaveURL(/\/sifre-sifirla$/);
  }
});

test("the reset page is also served in English", async ({ page }) => {
  await page.goto("/en/reset-password/new?token=abc123");
  await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible();
});
