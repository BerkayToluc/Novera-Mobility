import { expect, test } from "@playwright/test";

// The corporate quote's delivery cities (SPEC §2.2.3, v0.9): chosen from the 81 provinces, by the
// first letters, several of them, never typed freely.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const box = (page: import("@playwright/test").Page) => page.getByRole("combobox", { name: "Teslim şehirleri" });
// Scoped to the city list: the form has native <select> options of its own.
const options = (page: import("@playwright/test").Page) =>
  page.getByRole("listbox", { name: "Teslim şehirleri" }).getByRole("option");

test("typing İ lists the cities that start with İ, and nothing else", async ({ page }) => {
  await page.goto("/kurumsal-teklif");
  await box(page).fill("İ");
  const names = await options(page).allInnerTexts();
  expect(names).toContain("İstanbul");
  expect(names).toContain("İzmir");
  // The dotless I is folded in, as the search elsewhere on the site does.
  expect(names.every((name) => /^[İIi]/i.test(name))).toBe(true);
  expect(names).not.toContain("Ankara");

  await box(page).fill("izm");
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toHaveText("İzmir");
  await box(page).fill("zzz");
  await expect(page.getByText("Bu harflerle başlayan şehir yok.")).toBeVisible();
});

test("several cities are chosen with the keyboard or the pointer, and removed again", async ({ page }) => {
  await page.goto("/kurumsal-teklif");
  await box(page).fill("an");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Ankara şehrini kaldır" })).toBeVisible();
  await box(page).fill("iz");
  await options(page).first().click();
  await expect(page.getByRole("button", { name: "İzmir şehrini kaldır" })).toBeVisible();
  // A chosen city is not offered again.
  await box(page).fill("ank");
  await expect(options(page)).toHaveCount(0);

  await page.getByRole("button", { name: "İzmir şehrini kaldır" }).click();
  await expect(page.getByRole("button", { name: "İzmir şehrini kaldır" })).toHaveCount(0);
  // Backspace on an empty field takes back the last one.
  await box(page).fill("");
  await box(page).press("Backspace");
  await expect(page.getByRole("button", { name: /şehrini kaldır/ })).toHaveCount(0);
});

test("a city cannot be typed freely, and Enter in the field does not send the form", async ({ page }) => {
  await page.goto("/kurumsal-teklif");
  await box(page).fill("Atlantis");
  await box(page).press("Enter");
  await expect(page.getByRole("button", { name: /şehrini kaldır/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Talebiniz alındı" })).toHaveCount(0);
});

test("the form asks for at least one city from the list", async ({ page }) => {
  await page.goto("/kurumsal-teklif");
  await page.getByLabel("Firma adı").fill("Ege Lojistik");
  await page.getByLabel("Yetkili ad soyad").fill("Mert Kaya");
  await page.getByLabel("İş e-postası").fill("filo@egelojistik.example");
  await page.getByLabel("Telefon").fill("0232 555 01 00");
  await page.getByText("SUV", { exact: true }).click();
  await page.getByRole("checkbox", { name: /aydınlatma|KVKK/i }).check();
  await page.getByRole("button", { name: "Teklif İste" }).click();
  await expect(page.getByText("Listeden en az bir teslim şehri seçin.")).toBeVisible();
});
