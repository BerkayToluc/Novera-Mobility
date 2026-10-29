import { expect, test } from "./fixtures";
import { expectNoAxeViolations } from "./axe";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The shared components of the panel on their gallery page (V2-24): each one used with a keyboard, its states, no overflow,
// and the accessibility check (WCAG 2.2 AA) on the page and on it with a window or a notice open.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const TABLE = "Örnek rezervasyonlar (yatay kaydırılabilir)";
// A 1x1 picture.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test.describe("the table and the way around a list", () => {
  test("it has a name, sortable headers with aria-sort, 5 rows to a page, and the sort is in the address", async ({ page }) => {
    await page.goto("/dev/admin");
    const region = page.getByRole("region", { name: TABLE });
    const table = region.getByRole("table", { name: "Örnek rezervasyonlar" });
    await expect(table.getByRole("row")).toHaveCount(6); // the header and 5
    // The default sort is by number, newest first.
    await expect(table.getByRole("columnheader", { name: /Numara/ })).toHaveAttribute("aria-sort", "descending");
    await expect(table.getByRole("columnheader", { name: /Tutar/ })).toHaveAttribute("aria-sort", "none");
    // The colour is never alone: every status chip carries a word.
    await expect(table.getByText("Onaylandı").first()).toBeVisible();

    const sort = table.getByRole("link", { name: "Tutar sütununa göre sırala" });
    await hydrated(sort);
    // The link is reached and used with the keyboard.
    await sort.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/sirala=total%3Aasc/);
    await expect(table.getByRole("columnheader", { name: /Tutar/ })).toHaveAttribute("aria-sort", "ascending");
    await table.getByRole("link", { name: "Tutar sütununa göre sırala" }).click();
    await expect(page).toHaveURL(/sirala=total%3Adesc/);
    await expect(table.getByRole("columnheader", { name: /Tutar/ })).toHaveAttribute("aria-sort", "descending");
  });

  test("the pages, the chips and the search put their choice in the address and start again from page 1", async ({ page }) => {
    await page.goto("/dev/admin");
    const pagination = page.getByRole("navigation", { name: "Sayfalar" });
    await expect(page.getByText("1–5 / 12 kayıt")).toBeVisible();
    // On a phone the numbers give way to "Page 1 of 3".
    const wide = (page.viewportSize()?.width ?? 0) >= 768;
    if (wide) await expect(pagination.getByRole("link", { name: "Sayfa 1" })).toHaveAttribute("aria-current", "page");
    else await expect(pagination.getByText("Sayfa 1 / 3")).toBeVisible();
    await expect(pagination.getByText("Önceki sayfa")).toBeVisible();

    await pagination.getByRole("link", { name: "Sonraki sayfa" }).click();
    await expect(page).toHaveURL(/sayfa=2/);
    await expect(page.getByText("6–10 / 12 kayıt")).toBeVisible();

    // A filter starts again from page 1, and says which chip is current.
    const chips = page.getByRole("navigation", { name: "Durum" });
    await chips.getByRole("link", { name: "Onaylandı" }).click();
    await expect(page).toHaveURL(/durum=CONFIRMED/);
    await expect(page).not.toHaveURL(/sayfa=/);
    await expect(chips.getByRole("link", { name: "Onaylandı" })).toHaveAttribute("aria-current", "page");

    // The search is a form: words, Enter, and they are in the address with the filter kept.
    const search = page.getByRole("search");
    const box = search.getByRole("searchbox", { name: "Rezervasyon ara" });
    await hydrated(box);
    await box.fill("ayşe");
    await box.press("Enter");
    await expect(page).toHaveURL(/ara=ay%C5%9Fe/);
    await expect(page).toHaveURL(/durum=CONFIRMED/);
    await expect(page.getByRole("region", { name: TABLE }).getByRole("row")).toHaveCount(2); // the header and Ayşe Yılmaz
    await search.getByRole("link", { name: "Aramayı temizle" }).click();
    await expect(page).not.toHaveURL(/ara=/);
  });

  test("an address made up by hand falls back to the defaults instead of an error", async ({ page }) => {
    await page.goto("/dev/admin?sayfa=-4&sirala=passwordHash:asc&durum=DROP&ara=" + "x".repeat(300));
    await expect(page.getByRole("heading", { level: 1, name: "Panel bileşenleri" })).toBeVisible();
    // Nothing matches 300 x's, so the empty state shows, with its own words.
    await expect(page.getByText("Henüz rezervasyon yok.").first()).toBeVisible();
  });

  test("the three states: loading, empty and error, each in words", async ({ page }) => {
    await page.goto("/dev/admin");
    const loading = page.getByRole("region", { name: "Yükleniyor (yatay kaydırılabilir)" });
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading.getByRole("status")).toHaveText("Liste yükleniyor");
    await expect(page.getByRole("heading", { level: 2, name: "Henüz rezervasyon yok." }).first()).toBeVisible();
    const error = page.getByRole("alert").filter({ hasText: "Liste yüklenemedi" });
    await expect(error).toBeVisible();
    await expect(error.getByRole("link", { name: "Yeniden dene" })).toBeVisible();
  });

  test("a wide table scrolls in its own box, which the keyboard can reach, and the page does not scroll sideways", async ({ page }) => {
    await page.goto("/dev/admin");
    const region = page.getByRole("region", { name: TABLE });
    await region.focus();
    await expect(region).toBeFocused();
    if ((page.viewportSize()?.width ?? 0) <= 375) {
      expect(await region.evaluate((box) => box.scrollWidth > box.clientWidth)).toBe(true);
    }
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("the form parts", () => {
  test("the bilingual field: both languages are required, the tab with the problem opens, arrows move between tabs", async ({ page }) => {
    await page.goto("/dev/admin");
    const group = page.getByRole("group", { name: "Açıklama" });
    const trTab = group.getByRole("tab", { name: /Türkçe/ });
    const enTab = group.getByRole("tab", { name: /İngilizce/ });
    await hydrated(trTab);
    await expect(trTab).toHaveAttribute("aria-selected", "true");
    await expect(group.getByText("Her iki dil de zorunlu")).toBeVisible();

    // Arrow keys move the selection and the focus (the tabs pattern).
    await trTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(enTab).toBeFocused();
    await expect(enTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(trTab).toHaveAttribute("aria-selected", "true");

    // Only the English text is filled: Save marks the Turkish one, in words, and its tab is the one that is open.
    await enTab.click();
    await group.getByRole("textbox", { name: "Açıklama, İngilizce" }).fill("A description");
    await page.getByRole("button", { name: "Kaydet" }).nth(1).click();
    await expect(trTab).toContainText("eksik");
    await expect(trTab).toHaveAttribute("aria-selected", "true");
    const trBox = group.getByRole("textbox", { name: "Açıklama, Türkçe" });
    await expect(trBox).toHaveAttribute("aria-invalid", "true");
    await expect(group.getByText("Bu dilde metin girin.")).toBeVisible();

    await trBox.fill("Bir açıklama");
    await page.getByRole("button", { name: "Kaydet" }).nth(1).click();
    await expect(page.getByRole("status").getByText("Bayi kaydedildi.")).toBeVisible();
  });

  test("the list field: add, type, reorder and delete with buttons only, and it says what happened", async ({ page }) => {
    await page.goto("/dev/admin");
    const group = page.getByRole("group", { name: "Çalışma saatleri" });
    const add = group.getByRole("button", { name: "Satır ekle" });
    await hydrated(add);
    await expect(group.getByRole("textbox")).toHaveCount(2);

    await add.click();
    // Focus goes into the new row, and a polite message says it is there.
    const third = group.getByRole("textbox", { name: "3. satır" });
    await expect(third).toBeFocused();
    await expect(group.getByRole("status")).toHaveText("Satır eklendi. Toplam 3 satır.");
    await third.fill("Paz kapalı");

    // Move the last row up: the order of the boxes changes and the pressed button keeps the focus.
    await group.getByRole("button", { name: "3. satır yukarı taşı" }).click();
    await expect(group.getByRole("status")).toHaveText("3. satır 2. sıraya taşındı.");
    await expect(group.getByRole("textbox").nth(1)).toHaveValue("Paz kapalı");
    await expect(group.getByRole("button", { name: "2. satır yukarı taşı" })).toBeFocused();
    // The first row cannot move up.
    await expect(group.getByRole("button", { name: "1. satır yukarı taşı" })).toBeDisabled();

    await group.getByRole("button", { name: "2. satır sil" }).click();
    await expect(group.getByRole("textbox")).toHaveCount(2);
    await expect(group.getByRole("status")).toHaveText("Satır silindi. Toplam 2 satır.");
    // Focus did not fall to the page: it is in a row.
    await expect(group.getByRole("textbox").nth(1)).toBeFocused();
  });

  test("the file field refuses a wrong type and a big file at once, keeps a good one and can drop it", async ({ page }) => {
    await page.goto("/dev/admin");
    const input = page.getByLabel("Fotoğraf");
    await hydrated(input);
    await expect(page.getByText("JPEG, PNG, WebP; en çok 5 MB")).toBeVisible();

    await input.setInputFiles({ name: "not-a-picture.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("Bu dosya türü kabul edilmiyor.")).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(6 * 1024 * 1024) });
    await expect(page.getByText("Dosya 5 MB'tan büyük.")).toBeVisible();

    await input.setInputFiles({ name: "bayi.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("bayi.png")).toBeVisible();
    await expect(page.getByText("Bu dosya türü kabul edilmiyor.")).toHaveCount(0);
    await page.getByRole("button", { name: "Dosyayı kaldır" }).click();
    await expect(page.getByText("Dosya seçilmedi")).toBeVisible();
  });
});

test.describe("windows, notices and warnings", () => {
  test("the confirmation window names the action, starts on Cancel, closes on Escape and gives the focus back", async ({ page }) => {
    await page.goto("/dev/admin");
    const opener = page.getByRole("button", { name: "Bayiyi kapat…" });
    await (await hydrated(opener)).click();
    const dialog = page.getByRole("dialog", { name: "Bayi kapatılsın mı?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Kapanan bayi sitede görünmez.")).toBeVisible();
    // The safe answer has the focus; the other button carries the name of what it does, not "Yes".
    await expect(dialog.getByRole("button", { name: "Vazgeç" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Bayiyi kapat" })).toBeVisible();
    await expectNoAxeViolations(page, "the confirmation window");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    // Confirming runs the action; while it runs the button says so, then a notice says it is done.
    await opener.click();
    await page.getByRole("dialog").getByRole("button", { name: "Bayiyi kapat" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("status").getByText("Bayi kaydedildi.")).toBeVisible();
  });

  test("a success is announced politely, an error as an alert and stays until it is dismissed", async ({ page }) => {
    await page.goto("/dev/admin");
    const ok = page.getByRole("button", { name: "Başarı bildirimi göster" });
    await (await hydrated(ok)).click();
    await expect(page.getByRole("status").getByText("Bayi kaydedildi.")).toBeVisible();

    await page.getByRole("button", { name: "Hata bildirimi göster" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Kaydedilemedi. Yeniden deneyin." });
    await expect(alert).toBeVisible();
    await expectNoAxeViolations(page, "the notices");
    await alert.getByRole("button", { name: "Bildirimi kapat" }).click();
    await expect(alert).toHaveCount(0);
  });

  test("the conflict warning is an alert with the way to load the current record", async ({ page }) => {
    await page.goto("/dev/admin");
    const banner = page.getByRole("alert").filter({ hasText: "Bu kayıt siz düzenlerken değişti" });
    await expect(banner).toBeVisible();
    await expect(banner.getByText("Girdikleriniz korundu.")).toBeVisible();
    await expect(banner.getByRole("button", { name: "Güncel kaydı yükle" })).toBeVisible();
  });

  test("leaving a page with unsaved changes asks first; without changes it does not", async ({ page, context }) => {
    await signInSample(context, "admin");
    await page.goto("/dev/admin");
    const link = page.getByRole("link", { name: "Özet sayfasına git" });
    const field = page.getByLabel("Bayi adı");
    await (await hydrated(field)).fill("Yeni b");

    await link.click();
    const dialog = page.getByRole("dialog", { name: "Kaydedilmemiş değişiklikler var" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/dev\/admin$/);
    // "Cancel" keeps the person here with what was typed.
    await dialog.getByRole("button", { name: "Vazgeç" }).click();
    await expect(dialog).toBeHidden();
    await expect(field).toHaveValue("Yeni b");

    await link.click();
    await page.getByRole("dialog").getByRole("button", { name: "Sayfadan çık" }).click();
    await expect(page).toHaveURL(/\/yonetim$/);

    // With nothing typed the link just goes.
    await page.goto("/dev/admin");
    await (await hydrated(page.getByLabel("Bayi adı"))).fill("");
    await page.getByRole("link", { name: "Özet sayfasına git" }).click();
    await expect(page).toHaveURL(/\/yonetim$/);
  });
});

test("English: the gallery and the table are in English", async ({ page }) => {
  await page.goto("/en/dev/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Panel components" })).toBeVisible();
  const region = page.getByRole("region", { name: "Sample bookings (scrolls sideways)" });
  await expect(region.getByRole("columnheader", { name: /Number/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pages" })).toBeVisible();
  await expect(page.getByText("1–5 of 12 records")).toBeVisible();
});

test("the whole gallery is free of accessibility violations", async ({ page }) => {
  await page.goto("/dev/admin");
  await hydrated(page.getByRole("button", { name: "Bayiyi kapat…" }));
  await expectNoAxeViolations(page, "the panel gallery");
});
