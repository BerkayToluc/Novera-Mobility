import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The user and audit log screens (V2-34, docs/ADMIN.md §3.11) on the six sample accounts and eleven sample log lines of
// mocks/admin-users.ts. A test that closes or opens something works in a world of its own (lib/mock-world.ts). That a closed
// account cannot sign in with the real API (password, Google, the old session) is covered by users.integration.spec.ts; here it is the
// sample sign-in that turns the address away, and the panel that shows the result.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

// The row of an account in the list: the name link starts with the person's name (the company is under it).
const userLink = (page: Page, name: string) => page.getByRole("link", { name: new RegExp("^" + name) });

test("the list shows each account with its kind and state, and narrows by word, type and state", async ({ page }) => {
  await page.goto("/yonetim/kullanicilar");
  await expect(page.getByRole("heading", { level: 1, name: "Kullanıcılar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Kullanıcılar" });
  await expect(table.getByRole("row")).toHaveCount(7);
  const row = (name: string) => table.getByRole("row").filter({ has: userLink(page, name) });
  await expect(row("Mert Kaya")).toContainText("Ege Lojistik A.Ş.");
  await expect(row("Mert Kaya")).toContainText("Kurumsal");
  await expect(row("Can Öztürk")).toContainText("Kapalı");
  await expect(row("Elif Yıldız")).toContainText("Açık");
  await expect(row("Deniz Yönetici")).toContainText("Yönetici");

  await page.goto("/yonetim/kullanicilar?durum=DISABLED");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/kullanicilar?tur=CORPORATE");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.goto("/yonetim/kullanicilar?ara=KAYA%20mert");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/kullanicilar?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan kullanıcı yok")).toBeVisible();
});

test("an account is opened for its details, and an administrator's has no way to close it", async ({ page }) => {
  await page.goto("/yonetim/kullanicilar");
  await userLink(page, "Elif Yıldız").click();
  await expect(page.getByRole("heading", { level: 1, name: "Elif Yıldız" })).toBeVisible();
  await expect(page.getByText("elif.yildiz@example.com")).toBeVisible();
  await expect(page.getByText("4 rezervasyon, 1 tanesi henüz başlamadı")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hesabı kapat" })).toBeVisible();

  await page.goto("/yonetim/kullanicilar");
  await userLink(page, "Deniz Yönetici").click();
  await expect(page.getByText("Yönetici hesabı buradan kapatılmaz")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hesabı kapat" })).toHaveCount(0);
});

test("closing an account asks first, says what it leaves, and the account can no longer sign in; opening it brings it back", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "kapat");
  await page.goto("/yonetim/kullanicilar");
  await userLink(page, "Mert Kaya").click();
  await expect(page.getByRole("heading", { level: 1, name: "Mert Kaya" })).toBeVisible();

  await (await hydrated(page.getByRole("button", { name: "Hesabı kapat" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Mert Kaya hesabı kapatılsın mı?");
  await expect(dialog).toContainText("2 rezervasyonu iptal edilmez");
  // Focus starts on the safe answer; keeping it open changes nothing.
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hesap kapatıldı" })).toHaveCount(0);

  await page.getByRole("button", { name: "Hesabı kapat" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hesabı kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hesap kapatıldı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hesabı yeniden aç" })).toBeVisible();
  await expect(page.getByText("Kapatıldığı tarih")).toBeVisible();
  // The bookings are still there.
  await expect(page.getByText("9 rezervasyon, 2 tanesi henüz başlamadı")).toBeVisible();

  // The sign-in turns the address away with the same words as a wrong password.
  await context.clearCookies({ name: "novera-mock-session" });
  await page.goto("/giris?tip=kurumsal");
  await page.getByLabel("Firma e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();
  await expect(page).toHaveURL(/\/giris/);

  // The administrator opens it again, and it signs in.
  await signInSample(context, "admin");
  await page.goto("/yonetim/kullanicilar?durum=DISABLED");
  await userLink(page, "Mert Kaya").click();
  await (await hydrated(page.getByRole("button", { name: "Hesabı yeniden aç" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Hesap yeniden açıldı" })).toBeVisible();
  await context.clearCookies({ name: "novera-mock-session" });
  await page.goto("/giris?tip=kurumsal");
  await page.getByLabel("Firma e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
});

test("the audit log lists the lines newest first with who, what and the field names, and narrows by who, kind and days", async ({ page }) => {
  await page.goto("/yonetim/kayit");
  await expect(page.getByRole("heading", { level: 1, name: "İşlem kaydı" })).toBeVisible();
  const table = page.getByRole("table", { name: "İşlem kaydı" });
  await expect(table.getByRole("row")).toHaveCount(12);
  const first = table.getByRole("row").nth(1);
  await expect(first).toContainText("Deniz Yönetici");
  await expect(first).toContainText("Hesabı kapattı");
  await expect(first).toContainText("Kullanıcı");
  // The field names are shown, never values; the person at the terminal is no account.
  await expect(table.getByRole("row").filter({ hasText: "Yönetici yetkisi verdi" })).toContainText("Komut satırı");
  await expect(table.getByRole("row").filter({ hasText: "Kampanya kodu ekledi" })).toContainText("code, percent, validTo");

  await page.goto("/yonetim/kayit?alan=company");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.goto("/yonetim/kayit?yonetici=cli");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/kayit?bit=2000-01-01");
  await expect(page.getByText("Bu süzgece uyan kayıt yok")).toBeVisible();
  // A day that is not a day is left out and shows the log.
  await page.goto("/yonetim/kayit?bas=yesterday&yonetici=someone");
  await expect(table.getByRole("row")).toHaveCount(12);
});

test("what is closed in the panel is in the audit log, and the log has no way to be changed", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "kayit");
  await page.goto("/yonetim/kullanicilar");
  await userLink(page, "Ece Aydın").click();
  await (await hydrated(page.getByRole("button", { name: "Hesabı kapat" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hesabı kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hesap kapatıldı" })).toBeVisible();

  await page.goto("/yonetim/kayit?alan=user");
  const table = page.getByRole("table", { name: "İşlem kaydı" });
  await expect(table.getByRole("row").nth(1)).toContainText("Hesabı kapattı");
  await expect(table.getByRole("row").nth(1)).toContainText("Deniz Yönetici");
  // A read only screen: no button, no form that writes.
  await expect(page.locator("#main").getByRole("button", { name: /sil|düzenle|kaydet/i })).toHaveCount(0);
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await userLink(page, "Can Öztürk").click();
  await expect(page).toHaveURL(/\/en\/admin\/users\/6a000000-0000-4000-8000-000000000006$/);
  await expect(page.getByRole("button", { name: "Reopen the account" })).toBeVisible();
  await page.goto("/en/admin/audit-log");
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await expect(page.getByText("Closed an account").first()).toBeVisible();
});
