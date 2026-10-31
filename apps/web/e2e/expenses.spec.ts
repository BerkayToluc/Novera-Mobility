import type { BrowserContext, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The expenses and the renewal request (V2-38, docs/ADMIN.md §3.16 and docs/FLEET.md §3) on the sample of Ege Lojistik A.Ş.: nine expenses on
// two cars (mocks/expenses.ts). Ayşe Demir has had 35 FLM 101 for sixty days, so what happened on it since is hers; Burak Yılmaz had
// 35 FLM 102 until thirty-five days ago, so what happened on it between is his and the rest has nobody. A test that changes things works in a
// world of its own (lib/mock-world.ts). That another company's expense is a 404, that a foreign id refuses a whole bulk call and that the
// person is worked out at the moment of the expense are covered against the real API and the database by fleet-expenses.integration.spec.ts;
// here it is what the person sees and does.
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" }]);
});

async function ownWorld(context: BrowserContext, testInfo: TestInfo, word: string): Promise<string> {
  // A retry starts in a world of its own too, or what the first attempt changed would still be there.
  const world = `e2e-${testInfo.project.name}-${word}-${testInfo.retry}`;
  await context.addCookies([{ name: "novera-mock-world", value: world, url: "http://localhost:3200" }]);
  return world;
}

test("the customer sees each expense with the person who had the car then, and narrows the list", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/filom/masraflar");
  await expect(page.getByRole("heading", { level: 1, name: "Masraflar" })).toBeVisible();
  const table = page.getByRole("table", { name: "Masraflar" });
  await expect(table.getByRole("row")).toHaveCount(10);
  await expect(table.getByRole("row").filter({ hasText: "Ayşe Demir" })).toHaveCount(5);
  await expect(table.getByRole("row").filter({ hasText: "Burak Yılmaz" })).toHaveCount(2);
  await expect(table.getByRole("row").filter({ hasText: "Atanmamış" })).toHaveCount(2);

  await page.goto("/filom/masraflar?tur=PENALTY");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.goto("/filom/masraflar?durum=DISPUTED");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/filom/masraflar?personel=yok");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.goto("/filom/masraflar?tur=PENALTY&durum=DISPUTED");
  await expect(page.getByText("Bu süzgece uyan masraf yok")).toBeVisible();
  // A made-up address shows the list, not an error.
  await page.goto("/filom/masraflar?arac=x&bas=bugun&personel=kimse");
  await expect(table.getByRole("row")).toHaveCount(10);
});

test("the open expenses of people are reflected together; the ones nobody had cannot be chosen, and a reflected expense is final", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "yansit");
  await signInSample(context, "corporate");
  await page.goto("/filom/masraflar");
  const table = page.getByRole("table", { name: "Masraflar" });

  // 5 of the 7 open ones had a person; 2 had nobody and have no box. A disputed and a reflected one have none either.
  await expect(table.getByRole("checkbox")).toHaveCount(1 + 5);
  const button = await hydrated(page.getByRole("button", { name: "Personele yansıt" }));
  await expect(button).toBeDisabled();
  await table.getByRole("checkbox", { name: "Bu sayfadaki yansıtılabilir masrafların tümünü seç" }).check();
  await expect(page.getByRole("button", { name: "Personele yansıt (5)" })).toBeEnabled();
  await expect(page.getByText("5 masraf seçili.")).toBeVisible();

  const dialog = async () => {
    await page.getByRole("button", { name: "Personele yansıt (5)" }).click();
    return page.getByRole("dialog", { name: "5 masraf personele yansıtılsın mı?" });
  };
  await (await dialog()).getByRole("button", { name: "Vazgeç" }).click();
  await expect(table.getByRole("row").filter({ hasText: "Personele yansıtıldı" })).toHaveCount(1);

  await (await dialog()).getByRole("button", { name: "Yansıt" }).click();
  await expect(page.getByText("5 masraf personele yansıtıldı.")).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: "Personele yansıtıldı" })).toHaveCount(6);
  await expect(table.getByRole("checkbox")).toHaveCount(1);
  await expect(table.getByRole("checkbox").first()).toBeDisabled();

  // The summary counts what is still open: only the two nobody had.
  await page.goto("/filom");
  await expect(page.locator("dt", { hasText: "Açık masraf" }).locator("xpath=following-sibling::dd[1]")).toHaveText("2");
});

test("an open expense is disputed and the dispute taken back, and a stale screen does not overwrite a change", async ({ page, context, browser }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "itiraz");
  await signInSample(context, "corporate");
  await page.goto("/filom/masraflar?tur=PENALTY&durum=OPEN");
  const table = page.getByRole("table", { name: "Masraflar" });
  await expect(table.getByRole("row")).toHaveCount(3);
  const staleButton = await hydrated(table.getByRole("button", { name: /^İtiraz et: / }).first());

  // Someone else disputes the same expense from another screen of the same world.
  const other = await browser.newContext({ baseURL: "http://localhost:3200" });
  await other.addCookies((await context.cookies()).map((cookie) => ({ name: cookie.name, value: cookie.value, url: "http://localhost:3200" })));
  const otherPage = await other.newPage();
  await otherPage.goto("/filom/masraflar?tur=PENALTY&durum=OPEN");
  await (await hydrated(otherPage.getByRole("button", { name: /^İtiraz et: / }).first())).click();
  await expect(otherPage.getByText("Masrafa itiraz edildi.")).toBeVisible();
  await other.close();

  await staleButton.click();
  await expect(page.getByText("Masraf bu arada değişmiş; liste yenilendi, tekrar deneyin.")).toBeVisible();

  await page.goto("/filom/masraflar?durum=DISPUTED");
  await expect(table.getByRole("row")).toHaveCount(3);
  await (await hydrated(table.getByRole("button", { name: /^İtirazı geri al: / }).first())).click();
  await expect(page.getByText("İtiraz geri alındı.")).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(2);
});

test("the administrator enters an expense by the plate, and it shows to the customer with the person who has the car", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "giris");
  await signInSample(context, "admin");
  await page.goto("/yonetim/filo-masraflari");
  await expect(page.getByRole("heading", { level: 1, name: "Filo masrafları" })).toBeVisible();
  const table = page.getByRole("table", { name: "Filo masrafları" });
  await expect(table.getByRole("row")).toHaveCount(10);
  await expect(table.getByRole("row").nth(1)).toContainText("Ege Lojistik A.Ş.");

  const form = page.getByRole("form", { name: "Masraf girişi" });
  const submit = await hydrated(form.getByRole("button", { name: "Masrafı kaydet" }));
  await submit.click();
  await expect(form.getByText("Geçerli bir plaka yazın.")).toBeVisible();
  await expect(form.getByText("Geçerli bir zaman girin.")).toBeVisible();
  await expect(form.getByText("Tutarı 0,01 ile 10.000.000 TL arasında yazın.")).toBeVisible();

  await form.getByLabel("Araç plakası").fill("34 ZZZ 999");
  await form.getByLabel("Ne zaman oldu").fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 16));
  await form.getByLabel("Tutar (TL)").fill("77,25");
  await submit.click();
  await expect(form.getByText("Bu plakada bir filo aracı yok.")).toBeVisible();

  await form.getByLabel("Araç plakası").fill("35flm101");
  await form.getByLabel("Yer").fill("Avrasya Tüneli");
  await submit.click();
  await expect(page.getByText("Masraf kaydedildi.")).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(11);

  // The future is refused.
  await form.getByLabel("Araç plakası").fill("35 FLM 101");
  await form.getByLabel("Ne zaman oldu").fill("2099-01-01T10:00");
  await form.getByLabel("Tutar (TL)").fill("10");
  await submit.click();
  await expect(form.getByText("Gelecekteki bir zaman girilemez.", { exact: true })).toBeVisible();

  await page.goto("/yonetim/filo-masraflari?durum=DISPUTED&tur=HGS");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.goto("/yonetim/filo-masraflari?ara=102");
  await expect(table.getByRole("row")).toHaveCount(4);
  await page.goto("/yonetim/filo-masraflari?ara=kimse");
  await expect(page.getByText("Bu aramaya uyan masraf yok")).toBeVisible();

  // The customer sees the new expense on the same car, with the person who has it.
  await signInSample(context, "corporate");
  await page.goto("/filom/masraflar");
  const mine = page.getByRole("table", { name: "Masraflar" });
  await expect(mine.getByRole("row")).toHaveCount(11);
  await expect(mine.getByRole("row").filter({ hasText: "77,25" })).toContainText("Ayşe Demir");
});

test("a renewal request from the contract page shows among the quotes of the panel, and is asked for once", async ({ page, context }, testInfo) => {
  test.slow();
  await ownWorld(context, testInfo, "yenileme");
  await signInSample(context, "corporate");
  await page.goto("/filom/sozlesmeler");
  await page.getByRole("table", { name: "Sözleşmeler" }).getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  const section = page.getByRole("region", { name: "Sözleşmeyi yenile" });
  const send = await hydrated(section.getByRole("button", { name: "Yenileme talebi gönder" }));
  await section.getByLabel("Satış ekibine not (isteğe bağlı)").fill("Beş araç daha ekleyelim");
  await send.click();
  await expect(section.getByText(/Yenileme talebiniz alındı\. Başvuru numaranız: TKL-\d{4}-\d{5}/)).toBeVisible();

  await signInSample(context, "admin");
  await page.goto("/yonetim/teklifler?kaynak=FLEET_RENEWAL");
  await expect(page.getByRole("table").getByRole("row").filter({ hasText: "Ege Lojistik A.Ş." })).toHaveCount(1);

  // The second time the contract says it is being handled.
  await signInSample(context, "corporate");
  await page.goto("/filom/sozlesmeler");
  await page.getByRole("table", { name: "Sözleşmeler" }).getByRole("link", { name: /^SZL-\d{4}-00001$/ }).click();
  await (await hydrated(page.getByRole("button", { name: "Yenileme talebi gönder" }))).click();
  await expect(page.getByText("Bu sözleşme için işlemde bir yenileme talebiniz var; ekibimiz sizinle iletişime geçecek.")).toBeVisible();
});

test("in English the screens speak English, at phone width without a sideways page", async ({ page, context }) => {
  await signInSample(context, "corporate");
  await page.goto("/en/my-fleet/expenses");
  await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Expenses" }).getByRole("row").filter({ hasText: "Unassigned" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Reflect to employee" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await signInSample(context, "admin");
  await page.goto("/en/admin/fleet-expenses");
  await expect(page.getByRole("heading", { level: 1, name: "Fleet expenses" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save expense" })).toBeVisible();
});

test("the screens are not there for who they are not for", async ({ page, context }) => {
  await signInSample(context, "individual");
  for (const path of ["/yonetim/filo-masraflari", "/filom/masraflar"]) expect((await page.goto(path))?.status(), path).toBe(404);
  await signInSample(context, "admin");
  expect((await page.goto("/filom/masraflar"))?.status()).toBe(404);
  await signInSample(context, "corporate");
  expect((await page.goto("/yonetim/filo-masraflari"))?.status()).toBe(404);
  // A corporate account with no fleet contract gets the empty state of Filom instead of the expenses.
  await signInSample(context, "corporate-nofleet");
  await page.goto("/filom/masraflar");
  await expect(page.getByRole("heading", { level: 1, name: "Filom" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Masraflar" })).toHaveCount(0);
});
