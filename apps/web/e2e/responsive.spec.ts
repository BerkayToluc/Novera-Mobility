import { expect, test } from "@playwright/test";

// The page never scrolls sideways, from the narrowest phone (320 px) to a desktop (SPEC §5.7):
// a sample of every kind of page, at the widths where the layout changes. The full sweep (every
// page, seven widths, touch targets too) was run by hand on 16 October 2026; this keeps the worst
// regressions out: the header at 320 px, a label sticking out at 768 px, a wide table.
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
];

for (const width of [320, 414, 768, 1024]) {
  test(`no page scrolls sideways at ${width} px`, async ({ page }) => {
    // Fourteen pages in a row.
    test.setTimeout(120_000);
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
