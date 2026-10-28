import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { EXPERIENCED, RESULTS, fillCard, fillDriver, goToPayment } from "./driver-helpers";
import { signInSample } from "./mock-session";

// SPEC §2.10: the driver's details and the simulated licence check come before the card; anyone
// over 18 with a valid licence may rent, a US licence also needs the international permit, and
// nothing is kept.
test.beforeEach(async ({ context }) => {
  await signInSample(context);
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
  await expect(page.getByText(/Koşulları karşılıyorsunuz/)).toBeVisible();
  // Eligible is not enough: the licence has to be checked too.
  await expect(pay(page)).toBeDisabled();
  await verify(page).click();
  await expect(page.getByText("Ehliyet doğrulandı (deneme).")).toBeVisible();
  await expect(pay(page)).toBeEnabled();

  // Changing anything throws the finished check away.
  await page.getByLabel("Ehliyet numarası").fill("AB123457");
  await expect(pay(page)).toBeDisabled();
});

test("a driver under 18 is told why and cannot pay", async ({ page }) => {
  await goToPayment(page);
  await fillDriver(page, { ...EXPERIENCED, birthDate: "2010-01-01" });
  const alert = page.getByRole("alert").filter({ hasText: "koşulları karşılamıyorsunuz" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("En az 18 yaşında olmalısınız");
  await expect(verify(page)).toBeDisabled();
  await expect(pay(page)).toBeDisabled();
});

test("the day before the 18th birthday is too early, the birthday itself is not", async ({ page }) => {
  await goToPayment(page);
  // The rental starts on 14 December 2026.
  await fillDriver(page, { ...EXPERIENCED, birthDate: "2008-12-15" });
  await expect(notEligible(page)).toContainText("En az 18 yaşında");
  await page.getByLabel("Doğum tarihi").fill("2008-12-14");
  await expect(page.getByText(/Koşulları karşılıyorsunuz/)).toBeVisible();
});

test("the car does not matter: the same young driver may take the SUV as the Clio", async ({ page }) => {
  const young = { ...EXPERIENCED, birthDate: "2006-06-01", licenceIssuedAt: "2025-01-01" };
  await goToPayment(page);
  await fillDriver(page, young);
  await expect(page.getByText(/Koşulları karşılıyorsunuz/)).toBeVisible();

  await goToPayment(page, /Kirala.*Nissan Qashqai/);
  await fillDriver(page, young);
  await expect(page.getByText(/Koşulları karşılıyorsunuz/)).toBeVisible();
});

test("the country matters only for the international permit: a US licence needs the declaration", async ({ page }) => {
  await goToPayment(page);
  await fillDriver(page, EXPERIENCED);
  await expect(page.getByText(/Koşulları karşılıyorsunuz/)).toBeVisible();

  await page.getByLabel("Ehliyetin verildiği ülke").selectOption({ label: "ABD" });
  await expect(page.getByLabel("Uluslararası sürücü belgem var.")).toBeVisible();
  // Eligible, but the permit declaration is still missing.
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

test("the cards say nothing about age or years of licence; the summary states the one rule", async ({ page }) => {
  await page.goto(RESULTS);
  await expect(page.getByText(/yaş · .* yıl ehliyet/)).toHaveCount(0);
  await page.getByRole("button", { name: /Kirala.*Renault Clio/ }).click();
  await page.waitForURL(/\/rezervasyon/);
  await expect(page.getByText("18 yaşından büyük ve geçerli ehliyeti olan herkes kiralayabilir.")).toBeVisible();
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
