import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The company screens (V2-33, docs/ADMIN.md §3.3) on the three sample companies of mocks/admin-companies.ts. A test that adds or
// changes something works in a world of its own (lib/mock-world.ts). Signing in with the invitation's password is covered in the
// API's integration test; here the page the e-mail's link opens and the way on from it.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
  await signInSample(context, "admin");
});

// The link of a company has its city and tax office under the name, so the name is the start of the link's text.
const companyLink = (page: Page, name: string) => page.getByRole("link", { name: new RegExp("^" + name.replaceAll(".", String.raw`\.`)) });

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

test("the list shows each company with its people and the ones still waiting, and narrows by search", async ({ page }) => {
  await page.goto("/yonetim/sirketler");
  await expect(page.getByRole("heading", { level: 1, name: "Şirketler" })).toBeVisible();
  const table = page.getByRole("table", { name: "Şirketler" });
  const row = (name: string) => table.getByRole("row").filter({ has: companyLink(page, name) });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(row("Ege Lojistik A.Ş.")).toContainText("İzmir");
  await expect(row("Ege Lojistik A.Ş.").getByRole("cell").nth(1)).toHaveText("2");
  await expect(row("Ege Lojistik A.Ş.").getByRole("cell").nth(2)).toHaveText("1");
  await expect(row("Anadolu İnşaat A.Ş.").getByRole("cell").nth(1)).toHaveText("0");

  await page.goto("/yonetim/sirketler?sirala=users:desc");
  await expect(table.getByRole("row").nth(1)).toContainText("Ege Lojistik A.Ş.");
  await page.goto("/yonetim/sirketler?ara=MARMARA");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/sirketler?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan şirket yok")).toBeVisible();
});

test("a company is made, and a name that is taken is refused with the reason", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "yeni");
  await page.goto("/yonetim/sirketler/yeni");
  await (await hydrated(page.getByRole("button", { name: "Şirketi oluştur" }))).click();
  await expect(page.getByText("2 ile 120 karakter arasında bir ad yazın.")).toBeVisible();

  await page.getByLabel("Şirket adı").fill("  ege lojistik a.ş.  ");
  await page.getByRole("button", { name: "Şirketi oluştur" }).click();
  await expect(page.getByText("Bu adda bir şirket zaten var.")).toBeVisible();

  // The sales contact is all three fields or none.
  await page.getByLabel("Şirket adı").fill("Doğu Taşımacılık A.Ş.");
  await page.getByLabel("Şehir").fill("Erzurum");
  await page.getByLabel("Temsilcinin adı").fill("Selin Aksoy");
  await page.getByRole("button", { name: "Şirketi oluştur" }).click();
  await expect(page.getByText("Temsilcinin geçerli bir e-posta adresini yazın.")).toBeVisible();
  await page.getByLabel("Temsilcinin adı").fill("");
  await page.getByRole("button", { name: "Şirketi oluştur" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Doğu Taşımacılık A.Ş." })).toBeVisible();
  await expect(page.getByText("Bu şirkete henüz kimse davet edilmedi.")).toBeVisible();
  await page.goto("/yonetim/sirketler");
  await expect(page.getByRole("table", { name: "Şirketler" }).getByRole("row")).toHaveCount(5);
});

test("a company's details are changed and saved", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "duzenle");
  await page.goto("/yonetim/sirketler");
  await companyLink(page, "Marmara Turizm Ltd. Şti.").click();
  await expect(page.getByLabel("Vergi dairesi")).toHaveValue("Kadıköy");
  await page.getByLabel("Vergi dairesi").fill("Üsküdar");
  await (await hydrated(page.getByRole("button", { name: "Değişiklikleri kaydet" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" })).toBeVisible();
  await expect(page.getByLabel("Vergi dairesi")).toHaveValue("Üsküdar");
});

test("a person is invited, waits for the password, and the invitation is sent again", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "davet");
  await page.goto("/yonetim/sirketler");
  await companyLink(page, "Anadolu İnşaat A.Ş.").click();
  await expect(page.getByText("Bu şirkete henüz kimse davet edilmedi.")).toBeVisible();

  const form = page.getByRole("form", { name: "Kişi davet et" });
  await (await hydrated(form.getByRole("button", { name: "Davet gönder" }))).click();
  await expect(form.getByText("Geçerli bir e-posta adresi yazın.")).toBeVisible();

  // An address that already has an account is refused.
  await form.getByLabel("E-posta", { exact: true }).fill("mert.kaya@egelojistik.example");
  await form.getByLabel("Ad", { exact: true }).fill("Mert");
  await form.getByLabel("Soyad").fill("Kaya");
  await form.getByRole("button", { name: "Davet gönder" }).click();
  await expect(form.getByText("Bu e-posta adresiyle zaten bir hesap var.")).toBeVisible();

  await form.getByLabel("E-posta", { exact: true }).fill("Yeni.Kisi@anadolu.example");
  await form.getByLabel("Görevi").fill("Şantiye Şefi");
  await form.getByRole("button", { name: "Davet gönder" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Davet gönderildi" })).toBeVisible();

  const person = page.getByRole("listitem").filter({ hasText: "Mert Kaya" });
  await expect(person).toContainText("yeni.kisi@anadolu.example");
  await expect(person).toContainText("Şantiye Şefi");
  await expect(person).toContainText("Davet bekliyor");
  await expect(person).toContainText("Bağlantı");

  await (await hydrated(person.getByRole("button", { name: "Daveti yeniden gönder: Mert Kaya" }))).click();
  await expect(page.getByRole("status").filter({ hasText: "Davet yeniden gönderildi" })).toBeVisible();

  // A person who has set a password has nothing to send again.
  await page.goto("/yonetim/sirketler");
  await companyLink(page, "Ege Lojistik A.Ş.").click();
  await expect(page.getByRole("listitem").filter({ hasText: "Mert Kaya" })).toContainText("Etkin");
  await expect(page.getByRole("listitem").filter({ hasText: "Deniz Arslan" })).toContainText("Davet bekliyor");
  await expect(page.getByRole("listitem").filter({ hasText: "Mert Kaya" }).getByRole("button")).toHaveCount(0);
});

test("the link in the invitation e-mail opens a page that welcomes the person, and leads on to the corporate sign-in", async ({ page, context }) => {
  // The person is not the administrator.
  await context.clearCookies({ name: "novera-mock-session" });
  await page.goto("/sifre-sifirla/yeni?token=abc123&tur=davet");
  await expect(page.getByRole("heading", { level: 1, name: "Kurumsal hesabınızı hazırlayın" })).toBeVisible();
  await page.getByLabel("Yeni şifre").fill("yeni-uzun-sifre-1");
  await page.getByRole("button", { name: "Şifreyi Kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Kurumsal giriş sekmesinden");
  await page.locator("#main").getByRole("link", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/giris\?tip=kurumsal$/);
  await expect(page.getByRole("navigation", { name: "Hesap türü" }).locator("[aria-current=page]")).toHaveText("Kurumsal");

  // A link that no longer works says who to ask, instead of offering a password reset the person never had.
  await page.goto("/sifre-sifirla/yeni?token=expired&tur=davet");
  await page.getByLabel("Yeni şifre").fill("yeni-uzun-sifre-1");
  await page.getByRole("button", { name: "Şifreyi Kaydet" }).click();
  await expect(page.locator("#main").getByRole("alert")).toContainText("Novera ekibinden daveti yeniden göndermesini isteyin");
  await expect(page.getByRole("link", { name: "Yeni bağlantı iste" })).toHaveCount(0);
});

test("the English panel has the screens in English", async ({ page }) => {
  await page.goto("/en/admin/companies");
  await expect(page.getByRole("heading", { level: 1, name: "Companies" })).toBeVisible();
  await companyLink(page, "Ege Lojistik A.Ş.").click();
  await expect(page).toHaveURL(/\/en\/admin\/companies\/5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01$/);
  await expect(page.getByRole("heading", { level: 2, name: "People" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Invite a person" })).toBeVisible();
});
