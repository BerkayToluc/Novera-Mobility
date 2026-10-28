import type { Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// V2-15 (QUALITY P-01): each page sends the browser only the text its client components use. A component that does not
// get its namespace logs "MISSING_MESSAGE" and shows the raw key instead of the words, so every page is opened in both
// languages (the sitemap, the account pages, the booking and payment steps); the fixture (e2e/fixtures.ts) fails a test
// that logs a missing message, and here the text is also checked for a raw key.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const FLOW = [
  "/rezervasyon?alis=x",
  "/odeme",
  "/giris",
  "/kayit",
  "/sifre-sifirla",
  "/sifre-sifirla/yeni?token=expired",
  "/kurumsal-teklif",
  "/iletisim",
  "/yardim",
  "/hizmetler",
  "/bayilerimiz",
  "/araclar",
];
const ACCOUNT = ["/profil", "/profil/rezervasyonlar", "/profil/puanlar", "/profil/teklifler", "/profil/ayarlar"];

// A message key that was not found renders as its own name ("HomePage.title"): a capitalised word, a dot, a word.
const RAW_KEY = /\b[A-Z][A-Za-z]+(?:\.[a-z][A-Za-z]*){1,3}\b/;

async function visit(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response?.status(), url).toBeLessThan(500);
  const text = await page.locator("body").innerText();
  const raw = text.match(RAW_KEY)?.[0];
  expect(raw ?? null, `${url} shows a message key instead of text`).toBeNull();
  // Every page, in both languages, against WCAG 2.2 AA (V2-19, QUALITY T-02).
  await expectNoAxeViolations(page, url);
}

for (const prefix of ["", "/en"]) {
  test(`the public pages of ${prefix || "/tr"} find all their text`, async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]!).pathname)
      .filter((pathname) => (prefix === "/en" ? pathname.startsWith("/en") : !pathname.startsWith("/en")));
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) await visit(page, url);
  });

  test(`the booking, form and sign-in pages of ${prefix || "/tr"} find all their text`, async ({ page }) => {
    for (const url of FLOW) await visit(page, prefix + url);
  });

  test(`the account pages of ${prefix || "/tr"} find all their text`, async ({ page, context }) => {
    await signInSample(context, "individual");
    for (const url of ACCOUNT) await visit(page, prefix + url);
  });
}
