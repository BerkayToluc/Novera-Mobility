import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// The page never scrolls sideways, from the narrowest phone (320 px) to a desktop (SPEC §5.7):
// a sample of every kind of page, at the widths where the layout changes. The full sweep (every
// page, seven widths, touch targets too) was run by hand on 16 October 2026; V2-20 (QUALITY U-05) ran
// it again, with both themes, and this keeps the worst regressions out: the header at 320 px, a label
// sticking out at 768 px, a wide table, and a dark-theme or account page that grows past the screen.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const PAGES = [
  "/",
  "/urunler",
  "/urunler/yesil-filo",
  "/hizmetler",
  "/bayilerimiz",
  "/hakkimizda",
  "/iletisim",
  "/yardim",
  "/kurumsal-teklif?urun=vip-mobilite",
  "/araclar?alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00",
  "/araclar?alis=istanbul-kadikoy&iade=istanbul-havalimani&baslangic=2026-12-14T10:00&bitis=2026-12-17T10:00&gorunum=izgara",
  "/en",
  "/en/services",
  "/en/products",
  "/giris",
  "/kayit",
  "/sifre-sifirla",
  "/odeme",
];

// The account pages need a signed-in visitor (the sample session).
const ACCOUNT = ["/profil", "/profil/rezervasyonlar", "/profil/puanlar", "/profil/teklifler", "/profil/ayarlar"];

for (const width of [320, 375, 414, 768, 1024, 1280]) {
  test(`no page scrolls sideways at ${width} px`, async ({ page }) => {
    // Eighteen pages in a row.
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      // Down to the footer, so everything that eases in has done so.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} at ${width} px`).toBeLessThanOrEqual(0);
    }
  });
}

test("the header fits a 320 px phone, and a social label stays inside the page at 768 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const right = await page.getByRole("banner").locator("button, a").evaluateAll((nodes) =>
    Math.max(...nodes.map((node) => node.getBoundingClientRect().right)),
  );
  expect(right).toBeLessThanOrEqual(320);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/en");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  const last = page.getByRole("contentinfo").getByRole("img", { name: /YouTube/ });
  await last.focus();
  const label = last.locator("span[aria-hidden=true]");
  await expect(label).toBeVisible();
  const box = (await label.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(768);
});

// The dark theme and the account pages (V2-20): the same rule, where the colours and the lists differ.
for (const theme of ["light", "dark"]) {
  for (const width of [320, 1280]) {
    test(`the account pages do not scroll sideways at ${width} px in the ${theme} theme`, async ({ page, context }) => {
      test.setTimeout(120_000);
      await context.addCookies([{ name: "novera-theme", value: theme, url: "http://localhost:3200" }]);
      await signInSample(context, "individual");
      await page.setViewportSize({ width, height: 900 });
      for (const path of ACCOUNT) {
        // The account pages settle after the sample session is read, so wait for the network to go quiet.
        await page.goto(path, { waitUntil: "networkidle" });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} at ${width} px, ${theme}`).toBeLessThanOrEqual(0);
      }
    });
  }
}
