import { expect, test, type Page } from "@playwright/test";

// The bookings page (SPEC §2.9, v0.8): cards with the branch names and times, the way there, a call
// to the branch, and a simulated cancellation; status chips in the address.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

async function openBookings(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("elif@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await page.goto("/profil/rezervasyonlar");
}

test("a booking card names the branches with the times, and offers the way there and a call", async ({ page }) => {
  await openBookings(page);
  const card = page.getByRole("listitem").filter({ hasText: "NVR-2026-00231" });
  await expect(card.getByText("İstanbul · Kadıköy")).toBeVisible();
  await expect(card.getByText("İzmir · Adnan Menderes Havalimanı")).toBeVisible();
  // The sample booking starts 30 days from today at 09:00 UTC, which is 12:00 in Istanbul (mocks/reservations.ts).
  const day = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000 + 30 * 86_400_000 + 9 * 3_600_000).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
  await expect(card.getByText(new RegExp(`${day}.*12:00`))).toBeVisible();
  await expect(card.getByText("Yaklaşan", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /Yol tarifi/ })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  await card.getByRole("button", { name: "Bayiyi ara" }).click();
  await expect(card.getByRole("link", { name: "Ara" })).toHaveAttribute("href", /^tel:\+902165550101/);
});

test("the chips narrow the list through the address", async ({ page }) => {
  await openBookings(page);
  const chips = page.getByRole("navigation", { name: "Rezervasyon durumu" });
  await expect(chips.getByRole("link", { name: "Tümü" })).toHaveAttribute("aria-current", "page");
  await chips.getByRole("link", { name: "İptal edilen" }).click();
  await expect(page).toHaveURL(/durum=iptal/);
  await expect(page.getByRole("listitem").filter({ hasText: "NVR-2026-00098" })).toBeVisible();
  await expect(page.getByText("NVR-2026-00231")).toHaveCount(0);
  await chips.getByRole("link", { name: "Geçmiş" }).click();
  await expect(page.getByText("NVR-2026-00142")).toBeVisible();
  await expect(page.getByText("NVR-2026-00098")).toHaveCount(0);
});

test("a coming booking can be cancelled after a question; it then shows as cancelled and earns no points", async ({ page }) => {
  await openBookings(page);
  const card = page.getByRole("listitem").filter({ hasText: "NVR-2026-00207" });
  await card.getByRole("button", { name: /İptal et/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Renault Clio rezervasyonu iptal edilsin mi/ })).toBeVisible();
  await expect(dialog.getByText("İptal edilen rezervasyon puan kazandırmaz.")).toBeVisible();
  // The dialog opens on the safe choice.
  await expect(dialog.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(card.getByText("Yaklaşan", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: /İptal et/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Evet, iptal et" }).click();
  const cancelled = page.getByRole("listitem").filter({ hasText: "NVR-2026-00207" });
  await expect(cancelled.getByText("İptal edildi", { exact: true })).toBeVisible();
  await expect(cancelled.getByRole("button", { name: /İptal et/ })).toHaveCount(0);
  await expect(cancelled.getByText(/puan kazan/)).toHaveCount(0);
});
