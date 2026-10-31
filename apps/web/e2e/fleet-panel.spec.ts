import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The Filom screens (V2-36, docs/FLEET.md §3) on the sample fleet of Ege Lojistik A.Ş.: one contract, two cars (35 FLM 101 with Ayşe
// Demir, 35 FLM 102 idle) and five people (one inactive). A test that gives a car away works in a world of its own (lib/mock-world.ts).
// That the same rules hold against the real API and the database (one open assignment, another company's record is a 404, a person made
// inactive gives the car back) is covered by fleet.integration.spec.ts; here it is what the person sees and does.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

const card = (page: Page, label: string) => page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");

test("a corporate account signs in, finds Filom in its profile, and sees the summary with numbers that match the lists", async ({ page }) => {
  await page.goto("/giris?tip=kurumsal");
  await page.getByLabel("Firma e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Şifre", { exact: true }).fill("sifre-1234");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/profil$/);

  await page.getByRole("link", { name: "Filom", exact: true }).click();
  await expect(page).toHaveURL(/\/filom$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(card(page, "Kullanımdaki araç")).toHaveText("2");
  await expect(card(page, "Zimmetli araç")).toHaveText("1");
  await expect(card(page, "Boşta araç")).toHaveText("1");
  await expect(card(page, "Etkin sözleşme")).toHaveText("1");
  await expect(card(page, "60 gün içinde biten sözleşme")).toHaveText("0");
  await expect(card(page, "Bakımı ya da muayenesi 30 gün içinde olan araç")).toHaveText("1");

  // A card opens the list it counts, narrowed the same way.
  await page.getByRole("link", { name: /Listeyi aç.*Boşta araç/ }).click();
  await expect(page).toHaveURL(/\/filom\/araclar\?.*zimmet=bosta/);
  const table = page.getByRole("table", { name: "Araçlar" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("35 FLM 102");
});

test("the cars are listed with who has them, narrowed by state and word, and a car opens with its details, history and readings", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/araclar");
  const table = page.getByRole("table", { name: "Araçlar" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").filter({ hasText: "35 FLM 101" })).toContainText("Ayşe Demir");
  await expect(table.getByRole("row").filter({ hasText: "35 FLM 102" })).toContainText("Boşta");

  await page.goto("/filom/araclar?zimmet=zimmetli");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/filom/araclar?ara=35flm102");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/filom/araclar?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan araç yok")).toBeVisible();

  await page.goto("/filom/araclar");
  await page.getByRole("link", { name: "35 FLM 101" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "35 FLM 101" })).toBeVisible();
  const facts = page.getByRole("region", { name: "Araç bilgileri" });
  await expect(facts).toContainText("Fiat Egea");
  await expect(facts).toContainText("20.100 km");
  await expect(facts).toContainText("Ayşe Demir");
  await expect(facts).toContainText("gün sonra");
  await expect(page.getByRole("region", { name: "Zimmet geçmişi" })).toContainText("Ayşe Demir");
  await expect(page.getByRole("region", { name: "Son okumalar" })).toContainText("Yakıt %55");
  // A car that has someone cannot be given to a second person: there is no form, only the way to take it back.
  await expect(page.getByRole("button", { name: "Aracı geri al" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aracı ver" })).toHaveCount(0);
});

test("a car is given to a person, shows with them and in the history, and is taken back", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "zimmet");
  await signInSample(context, "corporate");
  await page.goto("/filom/araclar/35FLM102");
  await expect(page.getByRole("heading", { level: 1, name: "35 FLM 102" })).toBeVisible();
  await expect(page.getByText("Araç boşta.")).toBeVisible();

  const form = page.getByRole("form", { name: "Zimmet" });
  await (await hydrated(form.getByRole("button", { name: "Aracı ver" }))).click();
  await expect(form.getByText("Listeden bir personel seçin.")).toBeVisible();
  // An inactive person is not offered.
  await expect(form.getByRole("option", { name: /İlker Polat/ })).toHaveCount(0);

  await form.getByLabel("Personel").selectOption({ label: "Cansu Arslan · Operasyon" });
  await form.getByLabel("Not").fill("Saha ziyaretleri için");
  await form.getByRole("button", { name: "Aracı ver" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç verildi" })).toBeVisible();
  await expect(page.getByText("Cansu Arslan kullanıyor")).toBeVisible();
  await expect(page.getByRole("region", { name: "Araç bilgileri" })).toContainText("Cansu Arslan");
  await expect(page.getByRole("region", { name: "Zimmet geçmişi" })).toContainText("Saha ziyaretleri için");
  await expect(page.getByRole("region", { name: "Zimmet geçmişi" }).getByRole("listitem")).toHaveCount(2);

  // The record of all assignments, and the person's own page, say the same.
  await page.goto("/filom/zimmet?durum=acik");
  await expect(page.getByRole("table", { name: "Zimmetler" }).getByRole("row")).toHaveCount(3);
  await page.goto("/filom/personel");
  await expect(page.getByRole("table", { name: "Personel" }).getByRole("row").filter({ hasText: "Cansu Arslan" })).toContainText("35 FLM 102");

  await page.goto("/filom/araclar/35FLM102");
  await (await hydrated(page.getByRole("button", { name: "Aracı geri al" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("35 FLM 102 geri alınsın mı?");
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByText("Cansu Arslan kullanıyor")).toBeVisible();
  await page.getByRole("button", { name: "Aracı geri al" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aracı geri al" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Araç geri alındı" })).toBeVisible();
  await expect(page.getByText("Araç boşta.")).toBeVisible();
  // The history keeps both: the one just ended and the old one.
  const history = page.getByRole("region", { name: "Zimmet geçmişi" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(history).toContainText("Cansu Arslan");
  await expect(history).toContainText("Burak Yılmaz");
});

test("a person is added, a sicil no is one person's, and a person made inactive gives the car back at once", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "personel");
  await signInSample(context, "corporate");
  await page.goto("/filom/personel");
  const table = page.getByRole("table", { name: "Personel" });
  await expect(table.getByRole("row")).toHaveCount(6);
  await expect(table.getByRole("row").filter({ hasText: "Ayşe Demir" })).toContainText("35 FLM 101");
  await expect(table.getByRole("row").filter({ hasText: "İlker Polat" })).toContainText("Pasif");

  await page.getByRole("link", { name: "Yeni personel" }).first().click();
  const form = page.getByRole("form", { name: "Yeni personel" });
  await (await hydrated(form.getByRole("button", { name: "Personeli ekle" }))).click();
  await expect(form.getByText("Adı yazın (en çok 60 karakter).", { exact: true })).toBeVisible();
  await form.getByLabel("Ad", { exact: true }).fill("Yeni");
  await form.getByLabel("Soyad").fill("Çalışan");
  await form.getByLabel("Sicil no").fill("orn-001");
  await form.getByLabel("E-posta").fill("degil");
  await form.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(form.getByText("Geçerli bir e-posta adresi yazın ya da boş bırakın.")).toBeVisible();
  await form.getByLabel("E-posta").fill("yeni@egelojistik.example");
  await form.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(form.getByText("Bu sicil no şirketinizin başka bir kişisinde.")).toBeVisible();
  await form.getByLabel("Sicil no").fill("ORN-100");
  await form.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(page).toHaveURL(/\/filom\/personel$/);
  await expect(page.getByRole("table", { name: "Personel" }).getByRole("row")).toHaveCount(7);

  // Ayşe Demir has the car 35 FLM 101: making her inactive says so, and gives the car back.
  await page.getByRole("link", { name: /^Ayşe Demir/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ayşe Demir" })).toBeVisible();
  await (await hydrated(page.getByRole("button", { name: "Pasifleştir" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("35 FLM 101 plakalı araç hemen geri gelir");
  await dialog.getByRole("button", { name: "Pasifleştir" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Personel pasifleştirildi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeniden etkinleştir" })).toBeVisible();

  await page.goto("/filom/araclar/35FLM101");
  await expect(page.getByText("Araç boşta.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Araç bilgileri" })).toContainText("Boşta");
  await page.goto("/filom/zimmet?durum=acik");
  await expect(page.getByText("Bu süzgece uyan zimmet yok")).toBeVisible();
});

test("the contracts are listed and opened, amounts are in lira, and a contract of another company does not exist", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/sozlesmeler");
  const table = page.getByRole("table", { name: "Sözleşmeler" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("Akıllı Kurumsal Filo");
  await expect(table.getByRole("row").nth(1)).toContainText("₺64.000,00");
  await expect(page.getByText("Tutarlar TL olarak gösterilir.")).toBeVisible();

  await table.getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^SZL-\d{4}-00001$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sözleşme bilgileri" })).toContainText("İzmir");
  await expect(page.getByRole("region", { name: "Araçlar" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("link", { name: "35 FLM 102" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "35 FLM 102" })).toBeVisible();

  const missing = await page.goto("/filom/sozlesmeler/SZL-2099-99999");
  expect(missing?.status()).toBe(404);
  expect((await page.goto("/filom/araclar/06ABC123"))?.status()).toBe(404);
});

test("an individual account and an administrator find no Filom, and a visitor who is not signed in is sent to the corporate sign-in", async ({ page, context }) => {
  for (const who of ["individual", "admin"] as const) {
    await signInSample(context, who);
    for (const address of ["/filom", "/filom/araclar", "/filom/personel/yeni"]) {
      const response = await page.goto(address);
      expect(response?.status(), `${who} ${address}`).toBe(404);
    }
  }
  // The profile of an individual account has no way in either.
  await signInSample(context, "individual");
  await page.goto("/profil");
  await expect(page.getByRole("link", { name: "Filom", exact: true })).toHaveCount(0);

  await context.clearCookies({ name: "novera-mock-session" });
  await page.goto("/filom/araclar");
  await expect(page).toHaveURL(/\/giris\?.*tip=kurumsal/);
  await expect(page).toHaveURL(/sonra=filom/);
});

test("a corporate account whose company has no fleet contract sees the empty state and the call for a quote, and no way in", async ({ page, context }) => {
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom");
  await expect(page.getByRole("heading", { level: 2, name: "Filonuz henüz yok" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Filom bölümleri" })).toHaveCount(0);
  // Every address under Filom says the same: there are no screens to reach by a made-up link.
  await page.goto("/filom/araclar");
  await expect(page.getByRole("heading", { level: 2, name: "Filonuz henüz yok" })).toBeVisible();
  await page.getByRole("link", { name: "Kurumsal teklif al" }).click();
  await expect(page).toHaveURL(/\/kurumsal-teklif$/);

  await page.goto("/profil");
  await expect(page.getByRole("link", { name: "Filom", exact: true })).toHaveCount(0);
});

test("Filom is not indexed, and the English screens are in English", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/en/my-fleet");
  await expect(page.getByRole("heading", { level: 1, name: "My fleet" })).toBeVisible();
  await expect(card(page, "Cars in use")).toHaveText("2");
  await page.goto("/en/my-fleet/vehicles/35FLM101");
  await expect(page.getByRole("button", { name: "Take the car back" })).toBeVisible();
  await page.goto("/en/my-fleet/employees");
  await expect(page.getByRole("link", { name: "New person" }).first()).toBeVisible();
  await page.goto("/en/my-fleet/contracts");
  await expect(page.getByText("Amounts are shown in Turkish lira (TRY).")).toBeVisible();
});
