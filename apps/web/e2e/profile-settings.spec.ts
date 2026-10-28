import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The points and settings pages (SPEC §2.9, v0.8): points with their worth and a way to spend them;
// settings with notifications and security, simulated while the API has no such calls.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

async function signIn(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
}

test("the points page says what the balance is worth and how to spend it", async ({ page }) => {
  await signIn(page);
  await page.goto("/profil/puanlar");
  await expect(page.getByText("= ₺825 değerinde")).toBeVisible();
  await expect(page.getByRole("link", { name: "Puanla öde" })).toBeVisible();
  await expect(page.getByText("1 puan = ₺5", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Puanlar kiralamada harcanır: 1 puan = ₺5, toplamın en çok yarısına kadar.")).toBeVisible();
});

test("a cancelled booking no longer counts: its points leave the pending balance", async ({ page }) => {
  await signIn(page);
  await page.goto("/profil/puanlar");
  const pending = page.getByText("Bekleyen puan").locator("xpath=following-sibling::dd[1]");
  const before = Number((await pending.innerText()).replace(/\D/g, ""));
  expect(before).toBeGreaterThan(0);

  await page.goto("/profil/rezervasyonlar");
  const card = page.getByRole("listitem").filter({ hasText: "NVR-2026-00207" });
  await card.getByRole("button", { name: /İptal et/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Evet, iptal et" }).click();
  await expect(card.getByText("İptal edildi", { exact: true })).toBeVisible();

  await page.goto("/profil/puanlar");
  const after = Number((await pending.innerText()).replace(/\D/g, ""));
  expect(after).toBeLessThan(before);
});

test("notifications are chosen and saved", async ({ page }) => {
  await signIn(page);
  await page.goto("/profil/ayarlar");
  const reminders = page.getByRole("checkbox", { name: /hatırlatma e-postası/ });
  const campaigns = page.getByRole("checkbox", { name: /Kampanya ve fırsat/ });
  await expect(reminders).toBeChecked();
  await expect(campaigns).not.toBeChecked();
  await campaigns.check();
  await page.getByRole("region", { name: "Bildirimler" }).getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Bildirim tercihleriniz kaydedildi.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Kampanya ve fırsat/ })).toBeChecked();
});

// The form is sent with Enter: an antivirus on the development machine lays a balloon over the submit
// button of any password form, which would swallow a click (it is not part of the page).
test("the password change checks the new one, and the other sessions can be closed", async ({ page }) => {
  await signIn(page);
  await page.goto("/profil/ayarlar");
  await page.getByLabel("Mevcut şifre").fill("sifre-1234");
  await page.getByLabel("Yeni şifre", { exact: true }).fill("kisa");
  await page.getByLabel("Yeni şifre (tekrar)").fill("kisa");
  await page.getByLabel("Yeni şifre (tekrar)").press("Enter");
  await expect(page.getByText("Yeni şifre en az 8 karakter olmalı.")).toBeVisible();

  await page.getByLabel("Yeni şifre", { exact: true }).fill("yeni-sifre-99");
  await page.getByLabel("Yeni şifre (tekrar)").fill("baska-sifre-99");
  await page.getByLabel("Yeni şifre (tekrar)").press("Enter");
  await expect(page.getByText("Şifreler aynı değil.")).toBeVisible();

  await page.getByLabel("Yeni şifre (tekrar)").fill("yeni-sifre-99");
  await page.getByLabel("Yeni şifre (tekrar)").press("Enter");
  await expect(page.getByText("Şifreniz değiştirildi.")).toBeVisible();

  const sessions = page.locator("section[aria-labelledby=sessions-title]");
  await expect(sessions.getByRole("listitem")).toHaveCount(2);
  await sessions.getByRole("button", { name: "Diğer oturumları kapat" }).click();
  await expect(sessions.getByRole("listitem")).toHaveCount(1);
});
