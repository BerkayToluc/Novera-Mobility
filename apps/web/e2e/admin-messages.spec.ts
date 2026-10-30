import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The contact message screens (V2-32, docs/ADMIN.md §3.2) on the six sample messages of mocks/fleet-world.ts: four wait, one is
// handled, one had its personal fields erased. A test that marks something works in a world of its own (lib/mock-world.ts).
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
  await signInSample(context, "admin");
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

test("the list shows each message with who sent it, the first words and the state, and narrows by state and search", async ({ page }) => {
  await page.goto("/yonetim/mesajlar");
  await expect(page.getByRole("heading", { level: 1, name: "İletişim mesajları" })).toBeVisible();
  const table = page.getByRole("table", { name: "İletişim mesajları" });
  const row = (subject: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name: subject, exact: true }) });
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(row("Kurumsal fiyat sorusu")).toContainText("Ayşe Yılmaz");
  await expect(row("Kurumsal fiyat sorusu")).toContainText("on araçlık bir filo");
  await expect(row("Kurumsal fiyat sorusu")).toContainText("Bekliyor");
  await expect(row("Fatura isteği")).toContainText("Ele alındı");
  await expect(row("Eski soru")).toContainText("Silinmiş");

  // The messages still waiting: four, as many as the summary says. The erased one is not among them.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Ele alınmadı" }).click();
  await expect(page).toHaveURL(/durum=ele-alinmadi/);
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Eski soru", exact: true })).toHaveCount(0);

  await page.goto("/yonetim/mesajlar?durum=ele-alindi");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Fatura isteği", exact: true })).toBeVisible();

  await page.goto("/yonetim/mesajlar?ara=MEHMET");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/mesajlar?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan mesaj yok")).toBeVisible();
});

test("the summary card opens the list of the messages still waiting, with the same number", async ({ page }) => {
  await page.goto("/yonetim");
  await expect(page.locator("dt", { hasText: "Ele alınmamış mesaj" }).locator("xpath=following-sibling::dd[1]")).toHaveText("4");
  await page.getByRole("link", { name: "Listeyi aç" }).last().click();
  await expect(page).toHaveURL(/\/yonetim\/mesajlar\?.*durum=ele-alinmadi/);
  await expect(page.getByRole("table", { name: "İletişim mesajları" }).getByRole("row")).toHaveCount(5);
});

test("a message is opened with the whole text, marked handled, and the mark taken back; the summary number follows", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "isaret");
  await page.goto("/yonetim/mesajlar");
  await page.getByRole("link", { name: "Kurumsal fiyat sorusu", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kurumsal fiyat sorusu" })).toBeVisible();
  await expect(page.getByText("Kasım ayında teslim gerekiyor, uygun musunuz?")).toBeVisible();
  await expect(page.getByText("ayse@example.com")).toBeVisible();

  await (await hydrated(page.getByRole("button", { name: "Ele alındı olarak işaretle" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Mesaj ele alındı olarak işaretlendi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "İşareti geri al" })).toBeVisible();
  await expect(page.getByText("Deniz Yönetici")).toBeVisible();

  await page.goto("/yonetim/mesajlar?durum=ele-alinmadi");
  await expect(page.getByRole("table", { name: "İletişim mesajları" }).getByRole("row")).toHaveCount(4);

  // Taken back with one press.
  await page.goto("/yonetim/mesajlar?durum=ele-alindi");
  await page.getByRole("link", { name: "Kurumsal fiyat sorusu", exact: true }).click();
  await (await hydrated(page.getByRole("button", { name: "İşareti geri al" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "İşaret geri alındı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ele alındı olarak işaretle" })).toBeVisible();
});

test("a message whose personal fields were erased shows what is left and takes no mark", async ({ page }) => {
  await page.goto("/yonetim/mesajlar");
  await page.getByRole("link", { name: "Eski soru", exact: true }).click();
  await expect(page.getByText("Saklama süresi dolduğu için mesajın metni silindi.")).toBeVisible();
  await expect(page.getByText("yanıtlanacak bir şey kalmadı")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ele alındı olarak işaretle" })).toHaveCount(0);
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/messages");
  await expect(page.getByRole("heading", { level: 1, name: "Contact messages" })).toBeVisible();
  await page.getByRole("link", { name: "Fatura isteği", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/admin\/messages\/m5$/);
  await expect(page.getByRole("button", { name: "Take the mark back" })).toBeVisible();
});
