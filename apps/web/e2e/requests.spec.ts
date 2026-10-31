import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The service requests (V2-41, docs/FLEET.md §3, docs/ADMIN.md §3.19, SPEC §3.D) on the sample of Ege Lojistik A.Ş.: four requests of its own
// (a roadside one on the way, a maintenance one with an appointment, a replacement vehicle that was returned, a roadside one just received)
// and one of Anadolu İnşaat that Ege must never see (mocks/requests.ts). A test that makes or moves a request works in a world of its own
// (lib/mock-world.ts). That another company's request is a 404, that the steps are the ones of the kind and that the company is held to
// 20 an hour against the real API and the database are covered by the API's tests; here it is what the person sees and does.
const year = new Date().getUTCFullYear();
const first = `TLP-${year}-00001`;

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

test("the customer's list shows its own requests with their step, never another company's, and narrows", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler");
  await expect(page.getByRole("heading", { level: 1, name: "Talepler" })).toBeVisible();
  const table = page.getByRole("table", { name: "Servis talepleri" });
  await expect(table.getByRole("row")).toHaveCount(1 + 4);
  await expect(table.getByRole("row").filter({ hasText: "Yolda" })).toHaveCount(1);
  await expect(table.getByRole("row").filter({ hasText: "Randevu verildi" })).toHaveCount(1);
  await expect(table.getByRole("row").filter({ hasText: "İade alındı" })).toHaveCount(1);
  await expect(table).not.toContainText("06 ANA 123");

  await page.goto("/filom/talepler?durum=acik");
  await expect(table.getByRole("row")).toHaveCount(1 + 3);
  await page.goto("/filom/talepler?tur=MAINTENANCE");
  await expect(table.getByRole("row")).toHaveCount(1 + 1);
  await page.goto("/filom/talepler?tur=MAINTENANCE&durum=EN_ROUTE");
  await expect(page.getByText("Bu süzgece uyan talep yok")).toBeVisible();
});

test("a request opens with its facts, a timeline and the operations desk, and the desk's number offers Call and Copy", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler");
  await page.getByRole("table", { name: "Servis talepleri" }).getByRole("link", { name: first }).click();
  await expect(page.getByRole("heading", { level: 1, name: first })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const facts = page.getByRole("region", { name: "Talep bilgileri" });
  await expect(facts).toContainText("Arıza");
  await expect(facts).toContainText("D550 Karayolu 12. km");
  await expect(facts).toContainText("35 FLM 101");
  await expect(facts).toContainText("Ege Çekici, 0532 000 00 01");

  const steps = page.getByRole("list", { name: "Talebin adımları" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Alındı");
  await expect(steps.nth(0)).toContainText("Şirketiniz");
  await expect(steps.nth(1)).toContainText("Yönlendirildi");
  await expect(steps.nth(1)).toContainText("Novera");
  await expect(steps.nth(2)).toContainText("Yolda");
  await expect(steps.nth(2)).toContainText("Çekici 20 dakika içinde orada.");

  // Under way, so it cannot be cancelled any more; and the desk and the emergency note are on the page.
  await expect(page.getByRole("button", { name: "Talebi iptal et" })).toHaveCount(0);
  const help = page.getByRole("complementary", { name: "Yardıma mı ihtiyacınız var?" });
  await expect(help).toContainText("112");
  await (await hydrated(help.getByRole("button"))).click();
  await expect(help.getByRole("link", { name: /Ara/ })).toBeVisible();
  await expect(help.getByRole("button", { name: /kopyala/i })).toBeVisible();
});

test("the form asks for the fields of the kind chosen, and says what is missing", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler/yeni");
  const form = page.getByRole("form", { name: "Yeni servis talebi" });
  await expect(form.getByLabel("Araç", { exact: true })).toHaveCount(0);
  await (await hydrated(form.getByRole("radio", { name: /Yol yardım/ }))).check();
  await expect(form.getByLabel("Olay türü")).toBeVisible();

  await form.getByRole("button", { name: "Talebi gönder" }).click();
  await expect(form.getByText("Bir araç seçin.")).toBeVisible();
  await expect(form.getByText("Olay türünü seçin.")).toBeVisible();
  await expect(form.getByText("Aracın nerede olduğunu yazın ya da konumunuzu kullanın.")).toBeVisible();

  await form.getByRole("radio", { name: /İkame araç/ }).check();
  await expect(form.getByLabel("Teslim adresi")).toBeVisible();
  await expect(form.getByLabel("Olay türü")).toHaveCount(0);
  await form.getByRole("button", { name: "Talebi gönder" }).click();
  await expect(form.getByText("Süreyi 1 ile 90 gün arasında yazın.")).toBeVisible();

  await form.getByRole("radio", { name: /Bakım ve lastik/ }).check();
  await form.getByLabel("Aracım vale ile alınsın").check();
  await expect(form.getByLabel("Alınacak adres")).toBeVisible();
  await form.getByRole("button", { name: "Talebi gönder" }).click();
  await expect(form.getByText("Geçerli bir adres yazın (en çok 200 karakter).")).toBeVisible();
  await expect(form.getByText("Bir işlem seçin.")).toBeVisible();
});

test("roadside: the location is asked for only when the button is pressed, and if it is refused the address is enough", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "konum-red");
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler/yeni");
  const form = page.getByRole("form", { name: "Yeni servis talebi" });
  await (await hydrated(form.getByRole("radio", { name: /Yol yardım/ }))).check();
  await form.getByLabel("Araç", { exact: true }).selectOption({ label: "35 FLM 102 · Togg T10X" });
  await form.getByLabel("Olay türü").selectOption("TIRE");

  // Nothing asked for the position yet; pressing the button with no permission leaves a note and a working form.
  await form.getByRole("button", { name: "Konumumu kullan" }).click();
  await expect(form.getByText("Konum alınamadı ya da izin verilmedi", { exact: false })).toBeVisible();
  await form.getByLabel("Adres").fill("Çiğli Organize Sanayi, İzmir");
  await form.getByRole("button", { name: "Talebi gönder" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^TLP-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Talep bilgileri" })).toContainText("Çiğli Organize Sanayi, İzmir");
});

test("roadside: with permission the position is used and no address is needed", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "konum-izin");
  await context.grantPermissions(["geolocation"], { origin: "http://localhost:3200" });
  await context.setGeolocation({ latitude: 38.4237, longitude: 27.1428 });
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler/yeni");
  const form = page.getByRole("form", { name: "Yeni servis talebi" });
  await (await hydrated(form.getByRole("radio", { name: /Yol yardım/ }))).check();
  await form.getByLabel("Araç", { exact: true }).selectOption({ label: "35 FLM 102 · Togg T10X" });
  await form.getByLabel("Olay türü").selectOption("BREAKDOWN");
  await form.getByRole("button", { name: "Konumumu kullan" }).click();
  await expect(form.getByText("Konum alındı: 38.42370, 27.14280", { exact: false })).toBeVisible();
  await form.getByRole("button", { name: "Talebi gönder" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^TLP-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Talep bilgileri" })).toContainText("Konum: 38.4237, 27.1428");
});

test("a request made in Filom is moved on in the panel and the customer's timeline follows", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "akis");
  await signInSample(context, "corporate");
  await page.goto("/filom/talepler/yeni");
  const form = page.getByRole("form", { name: "Yeni servis talebi" });
  await (await hydrated(form.getByRole("radio", { name: /Yol yardım/ }))).check();
  await form.getByLabel("Araç", { exact: true }).selectOption({ label: "35 FLM 101 · Fiat Egea" });
  await form.getByLabel("Olay türü").selectOption("ACCIDENT");
  await form.getByLabel("Adres").fill("Kemalpaşa Yolu 4. km");
  await form.getByRole("button", { name: "Talebi gönder" }).click();
  const heading = page.getByRole("heading", { level: 1, name: /^TLP-\d{4}-\d{5}$/ });
  await expect(heading).toBeVisible();
  // The car already has an open roadside request: a notice, not an obstacle.
  await expect(page.getByText(new RegExp(`Bu araç için aynı türde açık başka talep de var: TLP-${year}-00001`))).toBeVisible();
  const number = (await heading.textContent())!.trim();

  // In the panel: dispatched with a tow truck written down, then on the way.
  await signInSample(context, "admin");
  await page.goto("/yonetim/talepler");
  await page.getByRole("table", { name: "Servis talepleri" }).getByRole("link", { name: number }).click();
  const move = page.getByRole("form", { name: "Talebi ilerlet" });
  await (await hydrated(move.getByRole("button", { name: "Durumu kaydet" }))).click();
  await expect(move.getByText("Bir durum seçin.")).toBeVisible();
  await move.getByLabel("Yeni durum").selectOption("DISPATCHED");
  await move.getByLabel("Not (isteğe bağlı)").fill("Çekici yola çıktı.");
  await move.getByLabel("Atanan (çekici, servis, şoför)").fill("Kemalpaşa Çekici");
  await move.getByRole("button", { name: "Durumu kaydet" }).click();
  await expect(page.getByText(`${number} için durum "Yönlendirildi" yapıldı.`)).toBeVisible();
  await move.getByLabel("Yeni durum").selectOption("EN_ROUTE");
  await move.getByRole("button", { name: "Durumu kaydet" }).click();
  await expect(page.getByText(`${number} için durum "Yolda" yapıldı.`)).toBeVisible();
  // Only later steps are offered now, never the ones already passed.
  await expect(move.getByLabel("Yeni durum").locator("option")).toHaveText(["Durum seçin", "Tamamlandı", "İptal edildi"]);

  // The customer sees the three steps, the note and who is on it.
  await signInSample(context, "corporate");
  await page.goto(`/filom/talepler/${number}`);
  const steps = page.getByRole("list", { name: "Talebin adımları" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toContainText("Yönlendirildi");
  await expect(steps.nth(1)).toContainText("Çekici yola çıktı.");
  await expect(steps.nth(2)).toContainText("Yolda");
  await expect(page.getByRole("region", { name: "Talep bilgileri" })).toContainText("Kemalpaşa Çekici");
  await expect(page.getByRole("button", { name: "Talebi iptal et" })).toHaveCount(0);
});

test("the customer withdraws a request nobody has taken up, after being asked", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "iptal");
  await signInSample(context, "corporate");
  await page.goto(`/filom/talepler/TLP-${year}-00004`);
  await (await hydrated(page.getByRole("button", { name: "Talebi iptal et" }))).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`TLP-${year}-00004 iptal edilsin mi?`);
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByRole("button", { name: "Talebi iptal et" })).toBeVisible();
  await page.getByRole("button", { name: "Talebi iptal et" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Talebi iptal et" }).click();
  await expect(page.getByText(`TLP-${year}-00004 numaralı talep iptal edildi.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Talebi iptal et" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Talebin adımları" }).getByRole("listitem").last()).toContainText("İptal edildi");
});

test("the car's own page lists the requests for it and leads to a new one for that car", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/araclar/35FLM101");
  const section = page.getByRole("region", { name: "Bu aracın talepleri" });
  await expect(section.getByRole("listitem")).toHaveCount(2);
  await expect(section).toContainText(first);
  await section.getByRole("link", { name: "Bu araç için talep aç" }).click();
  await expect(page).toHaveURL(/\/filom\/talepler\/yeni\?arac=/);
  await page.getByRole("form", { name: "Yeni servis talebi" }).getByRole("radio", { name: /Bakım ve lastik/ }).check();
  await expect(page.getByLabel("Araç", { exact: true })).toHaveValue("7c000000-0000-4000-8000-000000000001");
});

test("the summary counts the open requests and opens them", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom");
  await expect(page.locator("dt", { hasText: "Açık talep" }).locator("xpath=following-sibling::dd[1]")).toHaveText("3");
  await page.getByRole("link", { name: /Talepleri aç/ }).click();
  await expect(page).toHaveURL(/\/filom\/talepler\?durum=acik/);
  await expect(page.getByRole("table", { name: "Servis talepleri" }).getByRole("row")).toHaveCount(1 + 3);
});

test("the administrator sees the requests of all the companies and narrows them", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/yonetim/talepler");
  await expect(page.getByRole("heading", { level: 1, name: "Servis talepleri" })).toBeVisible();
  const table = page.getByRole("table", { name: "Servis talepleri" });
  await expect(table.getByRole("row")).toHaveCount(1 + 5);
  await expect(table).toContainText("Ege Lojistik A.Ş.");
  await expect(table).toContainText("06 ANA 123");

  await page.goto("/yonetim/talepler?durum=acik");
  await expect(table.getByRole("row")).toHaveCount(1 + 4);
  await page.goto("/yonetim/talepler?tur=REPLACEMENT_VEHICLE");
  await expect(table.getByRole("row")).toHaveCount(1 + 1);
  await page.goto("/yonetim/talepler?ara=anadolu");
  await expect(table.getByRole("row")).toHaveCount(1 + 1);
  await page.goto("/yonetim/talepler?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan talep yok")).toBeVisible();

  // A request that is over has nothing to choose.
  await page.goto("/yonetim/talepler?durum=RETURNED");
  await table.getByRole("link", { name: /^TLP-\d{4}-\d{5}$/ }).first().click();
  await expect(page.getByText("Bu talep bitti; artık taşınamaz.")).toBeVisible();
});

test("in English the screens speak English, at phone width without a sideways page", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/en/my-fleet/requests");
  await expect(page.getByRole("heading", { level: 1, name: "Requests" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Service requests" })).toBeVisible();
  await page.goto("/en/my-fleet/requests/new");
  await expect(page.getByRole("form", { name: "New service request" })).toBeVisible();
  await page.goto(`/en/my-fleet/requests/${first}`);
  await expect(page.getByRole("list", { name: "Steps of the request" }).getByRole("listitem").first()).toContainText("Received");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await signInSample(context, "admin");
  await page.goto("/en/admin/requests");
  await expect(page.getByRole("heading", { level: 1, name: "Service requests" })).toBeVisible();
});

test("the screens are not there for who they are not for, and another company's request is a page that does not exist", async ({ page, context }) => {
  await signInSample(context, "individual");
  for (const path of ["/filom/talepler", "/filom/talepler/yeni", `/filom/talepler/${first}`, "/yonetim/talepler", `/yonetim/talepler/${first}`]) expect((await page.goto(path))?.status(), path).toBe(404);
  await signInSample(context, "admin");
  for (const path of ["/filom/talepler", `/filom/talepler/${first}`]) expect((await page.goto(path))?.status(), path).toBe(404);
  await signInSample(context, "corporate");
  expect((await page.goto("/yonetim/talepler"))?.status()).toBe(404);
  // Anadolu İnşaat's request is the fifth sample one.
  expect((await page.goto(`/filom/talepler/TLP-${year}-00005`))?.status()).toBe(404);
  expect((await page.goto("/filom/talepler/nope"))?.status()).toBe(404);
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/talepler");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Servis talepleri" })).toHaveCount(0);
});
