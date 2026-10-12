import { expect, test, type Page } from "@playwright/test";
import { EXPERIENCED, RESULTS, fillCard, fillDriver, goToPayment } from "./driver-helpers";

// SPEC §2.10: the driver's details and the simulated licence check come before the card, the rule
// depends on the car's class and the licence's country, and nothing is kept.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const verify = (page: Page) => page.getByRole("button", { name: "Ehliyetimi doğrula" });
// Next also keeps an alert of its own (the route announcer), so ours is picked by what it says.
const notEligible = (page: Page) => page.getByRole("alert").filter({ hasText: "koşulları karşılamıyorsunuz" });
const pay = (page: Page) => page.getByRole("button", { name: "Ödemeyi Tamamla" });

test("payment waits for the driver: closed at first, open once the licence is checked", async ({ page }) => {
  await goToPayment(page);
  await expect(pay(page)).toBeDisabled();
  await expect(page.getByText("Ödemeye geçmek için sürücü bilgilerini girip ehliyetinizi doğrulayın.")).toBeVisible();

  await fillDriver(page, EXPERIENCED);
  await expect(page.getByText(/Bu araç için koşulları karşılıyorsunuz/)).toBeVisible();
  // Eligible is not enough: the licence has to be checked too.
  await expect(pay(page)).toBeDisabled();
  await verify(page).click();
  await expect(page.getByText("Ehliyet doğrulandı (deneme).")).toBeVisible();
  await expect(pay(page)).toBeEnabled();

  // Changing anything throws the finished check away.
  await page.getByLabel("Ehliyet numarası").fill("AB123457");
  await expect(pay(page)).toBeDisabled();
});

test("a driver who is too young is told why, cannot pay, and can pick another car", async ({ page }) => {
  await goToPayment(page);
  await fillDriver(page, { ...EXPERIENCED, birthDate: "2010-01-01" });
  const alert = page.getByRole("alert").filter({ hasText: "koşulları karşılamıyorsunuz" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("En az 21 yaşında olmalısınız");
  await expect(verify(page)).toBeDisabled();
  await expect(pay(page)).toBeDisabled();
  await expect(alert.getByRole("link", { name: "Başka araç seç" })).toHaveAttribute("href", /\/araclar\?.*alis=/);
});

test("the day before the 21st birthday is too early, the birthday itself is not", async ({ page }) => {
  await goToPayment(page);
  // The rental starts on 14 December 2026.
  await fillDriver(page, { ...EXPERIENCED, birthDate: "2005-12-15" });
  await expect(notEligible(page)).toContainText("En az 21 yaşında");
  await page.getByLabel("Doğum tarihi").fill("2005-12-14");
  await expect(page.getByText(/Bu araç için koşulları karşılıyorsunuz/)).toBeVisible();
});

test("the class matters: a driver who passes for the Clio fails for the SUV", async ({ page }) => {
  // 22 years old with three years of licence on the first day.
  const young = { ...EXPERIENCED, birthDate: "2004-06-01", licenceIssuedAt: "2023-01-01" };
  await goToPayment(page);
  await fillDriver(page, young);
  await expect(page.getByText(/Bu araç için koşulları karşılıyorsunuz/)).toBeVisible();

  await goToPayment(page, /Kirala.*Nissan Qashqai/);
  await fillDriver(page, young);
  await expect(notEligible(page)).toContainText("En az 23 yaşında olmalısınız");
});

test("the country matters: a US licence needs more years and the international permit", async ({ page }) => {
  await goToPayment(page);
  // Three years of licence: enough for a Turkish licence in this class (2), not for a US one (2 + 2).
  await fillDriver(page, { ...EXPERIENCED, licenceIssuedAt: "2023-12-01" });
  await expect(page.getByText(/Bu araç için koşulları karşılıyorsunuz/)).toBeVisible();

  await page.getByLabel("Ehliyetin verildiği ülke").selectOption({ label: "ABD" });
  await expect(notEligible(page)).toContainText("en az 4 yıllık olmalı");
  await expect(page.getByLabel("Uluslararası sürücü belgem var.")).toBeVisible();

  // With a long licence the permit declaration is what is still missing.
  await page.getByLabel("Ehliyet veriliş tarihi").fill("2012-06-01");
  await verify(page).click();
  await expect(page.getByText("Bu ülkenin ehliyetiyle kiralamak için uluslararası sürücü belgesi gerekir.")).toBeVisible();
  await page.getByLabel("Uluslararası sürücü belgem var.").check();
  await verify(page).click();
  await expect(page.getByText("Ehliyet doğrulandı (deneme).")).toBeVisible();
});

test("the simulated check says when a licence has expired or is not on record", async ({ page }) => {
  await goToPayment(page);
  await fillDriver(page, { ...EXPERIENCED, licenceNumber: "AB123450" });
  await verify(page).click();
  await expect(page.getByText("Bu ehliyetin süresi dolmuş.")).toBeVisible();
  await expect(pay(page)).toBeDisabled();

  await page.getByLabel("Ehliyet numarası").fill("AB123459");
  await verify(page).click();
  await expect(page.getByText("Bu numarayla bir ehliyet bulunamadı.")).toBeVisible();
  await expect(pay(page)).toBeDisabled();
});

test("results and summary state the class's condition before anything is asked", async ({ page }) => {
  await page.goto(RESULTS);
  await expect(page.getByText("En az 23 yaş · 3 yıl ehliyet").first()).toBeVisible();
  await expect(page.getByText("En az 21 yaş · 2 yıl ehliyet").first()).toBeVisible();
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByText(/En az 21 yaş · 2 yıl ehliyet/)).toBeVisible();
});

test("nothing about the driver is kept: not in the address, the storage or a cookie", async ({ page }) => {
  await goToPayment(page);
  await fillDriver(page, EXPERIENCED);
  await verify(page).click();
  await fillCard(page);
  await pay(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rezervasyonunuz alındı" })).toBeVisible();

  const url = page.url();
  expect(url).not.toContain("1990");
  expect(url).not.toContain("AB123456");
  const kept = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  expect(kept).not.toContain("AB123456");
  expect(kept).not.toContain("1990-04-01");
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.value.includes("AB123456") || cookie.value.includes("1990-04-01"))).toBe(false);
});
