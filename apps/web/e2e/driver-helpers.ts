import { expect, type Page } from "@playwright/test";

// The results of a search whose first day is 14 December 2026, which is the day the driver's age
// and years of licence are counted on (SPEC §2.10).
export const RESULTS =
  "/araclar?alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00";

export type Driver = {
  birthDate: string;
  country: string; // the option's visible name
  licenceNumber: string;
  licenceIssuedAt: string;
  permit?: boolean;
};

// Someone who is 36 with a Turkish licence of fourteen years: fine for any class.
export const EXPERIENCED: Driver = {
  birthDate: "1990-04-01",
  country: "Türkiye",
  licenceNumber: "AB123456",
  licenceIssuedAt: "2012-06-01",
};

export async function fillDriver(page: Page, driver: Driver) {
  await page.getByLabel("Doğum tarihi").fill(driver.birthDate);
  await page.getByLabel("Ehliyetin verildiği ülke").selectOption({ label: driver.country });
  await page.getByLabel("Ehliyet numarası").fill(driver.licenceNumber);
  await page.getByLabel("Ehliyet veriliş tarihi").fill(driver.licenceIssuedAt);
  if (driver.permit) await page.getByLabel("Uluslararası sürücü belgem var.").check();
  await page.getByLabel(/Bilgilerin doğru olduğunu beyan ederim/).check();
}

// Holds a car from the results and goes on to the payment page.
export async function goToPayment(page: Page, car: RegExp = /Kirala.*Renault Clio/) {
  await page.goto(RESULTS);
  await page.getByRole("button", { name: car }).click();
  await page.waitForURL(/\/rezervasyon/);
  await page.getByRole("link", { name: "Ödemeye Geç" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ödeme" })).toBeVisible();
}

export async function fillCard(page: Page) {
  await page.getByLabel("Karttaki isim").fill("Elif Yıldız");
  await page.getByLabel("Kart numarası").fill("4242 4242 4242 4242");
  await page.getByLabel(/Son kullanma/).fill("12/30");
  await page.getByLabel("CVC").fill("123");
}
