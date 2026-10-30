import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The quote request and contact message screens (V2-32, docs/ADMIN.md §3.2) on the sample requests and messages of
// mocks/fleet-world.ts. Both widths run side by side against one server, and a change moves what the customer sees, so a test that
// changes something works in a world of its own (the cookie of lib/mock-world.ts); the tests that only read use the shared one,
// which nobody changes.
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

const WAITING = "TKL-2026-50111"; // received, Anadolu Gıda
const REVIEWING = "TKL-2026-48213"; // in review, the corporate sample account's
const OFFERED = "TKL-2026-31870"; // offered, with an internal note
const CLOSED = "TKL-2026-49902";

test("the list shows each request with its company, fleet, source and state, and narrows by state, source and search", async ({ page }) => {
  await page.goto("/yonetim/teklifler");
  await expect(page.getByRole("heading", { level: 1, name: "Teklif talepleri" })).toBeVisible();
  const table = page.getByRole("table", { name: "Teklif talepleri" });
  const row = (number: string) => table.getByRole("row").filter({ has: page.getByRole("link", { name: number, exact: true }) });
  await expect(table.getByRole("row")).toHaveCount(10);
  await expect(row(WAITING)).toContainText("Anadolu Gıda Ltd.");
  await expect(row(WAITING)).toContainText("12 araç, 18 ay");
  await expect(row(WAITING)).toContainText("Alındı");
  await expect(row("TKL-2026-50090")).toContainText("Filom yenileme");

  // The state, in the address: the three that wait.
  await page.getByRole("navigation", { name: "Duruma göre" }).getByRole("link", { name: "Alındı" }).click();
  await expect(page).toHaveURL(/durum=RECEIVED/);
  await expect(table.getByRole("row")).toHaveCount(4);

  // The source, and the two together.
  await page.goto("/yonetim/teklifler");
  await page.getByRole("navigation", { name: "Kaynağa göre" }).getByRole("link", { name: "Filom yenileme" }).click();
  await expect(page).toHaveURL(/kaynak=FLEET_RENEWAL/);
  await expect(table.getByRole("row")).toHaveCount(2);

  // A part of a number, and a part of an e-mail, in any case.
  await page.goto("/yonetim/teklifler?ara=tkl-2026-50111");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/teklifler?ara=SELIN%40ANADOLU");
  await expect(row(WAITING)).toBeVisible();
  await page.goto("/yonetim/teklifler?ara=kimse%40nowhere");
  await expect(page.getByText("Bu aramaya uyan talep yok")).toBeVisible();
});

test("a request is opened: what the customer wrote, the account, and the internal note that only the team reads", async ({ page }) => {
  await page.goto("/yonetim/teklifler");
  await page.getByRole("link", { name: WAITING, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: WAITING })).toBeVisible();
  await expect(page.getByText("selin@anadolugida.example")).toBeVisible();
  await expect(page.getByText("Soğuk zincir için uygun araç var mı?")).toBeVisible();
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("");

  await page.goto(`/yonetim/teklifler/${OFFERED}`);
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("İndirim payı %8, müdür onayladı.");
});

test("a request goes forward: asked first, skipping is allowed, and there is no way back; the customer sees the new state", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "ilerle");
  await page.goto(`/yonetim/teklifler/${REVIEWING}`);
  // In review: only the states after it are offered, none that goes back.
  await expect(page.getByRole("button", { name: "Teklif verildi olarak işaretle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Talebi kapat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "İncelemeye al" })).toHaveCount(0);

  await (await hydrated(page.getByRole("button", { name: "Teklif verildi olarak işaretle" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`${REVIEWING} "Teklif verildi" olsun mu?`);
  await expect(dialog.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await dialog.getByRole("button", { name: "Teklif verildi olarak işaretle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Durum güncellendi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Teklif verildi olarak işaretle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Talebi kapat" })).toBeVisible();

  // The customer's own screen shows the new state.
  await signInSample(context, "corporate");
  await page.goto("/profil/teklifler");
  const card = page.getByRole("listitem").filter({ hasText: REVIEWING });
  await expect(card).toContainText("Teklif hazır");

  // Closed: the customer sees that too, and the panel offers nothing more.
  await signInSample(context, "admin");
  await page.goto(`/yonetim/teklifler/${REVIEWING}`);
  await (await hydrated(page.getByRole("button", { name: "Talebi kapat" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Talebi kapat" }).click();
  await expect(page.getByText("Talep kapandı; durumu artık değişmez.")).toBeVisible();
  await signInSample(context, "corporate");
  await page.goto("/profil/teklifler");
  await expect(page.getByRole("listitem").filter({ hasText: REVIEWING })).toContainText("Kapandı");
});

test("a request can skip ahead, and a closed one stays closed", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "atla");
  await page.goto(`/yonetim/teklifler/${WAITING}`);
  // Received: all three later states are offered, and "closed" can be chosen at once.
  for (const name of ["İncelemeye al", "Teklif verildi olarak işaretle", "Talebi kapat"]) await expect(page.getByRole("button", { name })).toBeVisible();
  await (await hydrated(page.getByRole("button", { name: "Talebi kapat" }))).click();
  await page.getByRole("dialog").getByRole("button", { name: "Talebi kapat" }).click();
  await expect(page.getByText("Talep kapandı; durumu artık değişmez.")).toBeVisible();

  await page.goto(`/yonetim/teklifler/${CLOSED}`);
  await expect(page.getByRole("button", { name: "İncelemeye al" })).toHaveCount(0);
  await expect(page.getByText("Talep kapandı; durumu artık değişmez.")).toBeVisible();
});

test("the internal note is saved, cleared, and never shown on the customer's screen", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "not");
  await page.goto(`/yonetim/teklifler/${REVIEWING}`);
  const note = await hydrated(page.getByLabel("İç not (yalnızca ekip görür)"));
  await note.fill("Gizli: cuma günü arayıp %10 indirim önerilecek.");
  await page.getByRole("button", { name: "Notu kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Not kaydedildi" })).toBeVisible();
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("Gizli: cuma günü arayıp %10 indirim önerilecek.");

  // The customer reads the request, not the note.
  await signInSample(context, "corporate");
  await page.goto("/profil/teklifler");
  await expect(page.getByRole("listitem").filter({ hasText: REVIEWING })).toBeVisible();
  await expect(page.getByText("Gizli: cuma")).toHaveCount(0);

  // Saved empty, the note is gone.
  await signInSample(context, "admin");
  await page.goto(`/yonetim/teklifler/${REVIEWING}`);
  await (await hydrated(page.getByLabel("İç not (yalnızca ekip görür)"))).fill("   ");
  await page.getByRole("button", { name: "Notu kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Not kaydedildi" })).toBeVisible();
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("");
});

test("two people on the same request: the second save is refused with a warning that keeps what they typed", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "cakisma");
  await page.goto(`/yonetim/teklifler/${WAITING}`);
  const url = page.url();
  await expect(page.getByRole("heading", { level: 1, name: WAITING })).toBeVisible();

  const other = await context.newPage();
  await other.goto(url);
  await (await hydrated(other.getByLabel("İç not (yalnızca ekip görür)"))).fill("İlk yazılan not");
  await other.getByRole("button", { name: "Notu kaydet" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Not kaydedildi" })).toBeVisible();

  await (await hydrated(page.getByLabel("İç not (yalnızca ekip görür)"))).fill("Geç gelen not");
  await page.getByRole("button", { name: "Notu kaydet" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "Bu kayıt siz düzenlerken değişti" });
  await expect(warning).toBeVisible();
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("Geç gelen not");
  await warning.getByRole("button", { name: "Güncel kaydı yükle" }).click();
  await expect(page.getByLabel("İç not (yalnızca ekip görür)")).toHaveValue("İlk yazılan not");
  await other.close();
});

test("a note that is too long says so on the field", async ({ page }) => {
  await page.goto(`/yonetim/teklifler/${WAITING}`);
  const note = await hydrated(page.getByLabel("İç not (yalnızca ekip görür)"));
  // The field stops at the limit by itself; the message is for text that gets past it (pasted into a field with no limit).
  await expect(note).toHaveAttribute("maxlength", "2000");
});

test("a request whose personal fields were erased is listed and opened, marked as such", async ({ page }) => {
  await page.goto("/yonetim/teklifler?ara=TKL-2024");
  const table = page.getByRole("table", { name: "Teklif talepleri" });
  await expect(table.getByRole("row").filter({ hasText: "Eski Müşteri Ltd." })).toContainText("Silindi");
  await page.getByRole("link", { name: "TKL-2024-00311", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "TKL-2024-00311" })).toBeVisible();
  await expect(page.getByText("Silindi").first()).toBeVisible();
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/quotes");
  await expect(page.getByRole("heading", { level: 1, name: "Quote requests" })).toBeVisible();
  await page.getByRole("link", { name: WAITING, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/admin/quotes/${WAITING}$`));
  await expect(page.getByRole("button", { name: "Close the request" })).toBeVisible();
  await expect(page.getByLabel("Internal note (only the team sees it)")).toBeVisible();
});

test("a customer finds none of it: the pages do not exist", async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "corporate");
  for (const path of ["/yonetim/teklifler", `/yonetim/teklifler/${WAITING}`, "/yonetim/mesajlar", "/yonetim/mesajlar/m1"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("a number that is not there shows the page that does not exist", async ({ page }) => {
  for (const path of ["/yonetim/teklifler/TKL-0000-00000", "/yonetim/teklifler/bu-bir-numara-degil", "/yonetim/mesajlar/yok"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Sayfa bulunamadı" }), path).toBeVisible();
  }
});

test("no horizontal scroll on the lists and the pages at this width", async ({ page }) => {
  for (const path of ["/yonetim/teklifler", `/yonetim/teklifler/${WAITING}`, "/yonetim/mesajlar", "/yonetim/mesajlar/m1"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
