import { expect, test } from "@playwright/test";

// SPEC §8 step 1: from the home page, choose the branches and the dates and press Ara.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the individual form searches and lands on the results", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Araç Kirala" })).toBeVisible();

  await page.getByRole("combobox", { name: "Alış bayisi" }).click();
  await page.getByRole("option", { name: /Kadıköy/ }).click();
  await page.getByRole("combobox", { name: "Bırakacağınız bayi" }).click();
  await page.getByRole("option", { name: /İstanbul Havalimanı/ }).click();

  await page.getByRole("button", { name: /Alış ve iade tarihleri|Tarih aralığı seçin/ }).click();
  // Next month, so the days are in the future whenever this runs.
  await page.getByRole("button", { name: /Sonraki ay|Next month/i }).click();
  await page.getByRole("button", { name: /(^|\D)15(\D|$)/ }).first().click();
  await page.getByRole("button", { name: /(^|\D)18(\D|$)/ }).first().click();
  await page.getByRole("button", { name: "Uygula" }).click();
  await page.getByRole("button", { name: "Ara", exact: true }).click();

  await expect(page).toHaveURL(/\/araclar\?alis=istanbul-kadikoy&iade=istanbul-havalimani/);
  await expect(page.getByRole("heading", { level: 1, name: "Uygun Araçlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kirala/ }).first()).toBeVisible();
});

test("searching without choosing anything says what is missing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await expect(page.getByText("Alış bayisini seçin.")).toBeVisible();
  await expect(page).toHaveURL("http://localhost:3200/");
});
