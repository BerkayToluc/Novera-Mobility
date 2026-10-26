import { expect, test } from "@playwright/test";
import { hydrated } from "./hydration";

// The e-mail addresses (SPEC §2.6, after the Framer Smart Contact Link): pressed, a bubble offers
// sending a mail or copying the address.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the head office address opens a bubble to send or copy, and Escape closes it", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/iletisim");
  const trigger = page.getByRole("button", { name: "iletisim@novera.example" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await hydrated(trigger);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const bubble = page.getByRole("group", { name: "E-posta adresi" });
  await expect(bubble.getByRole("link", { name: "E-posta gönder" })).toHaveAttribute("href", "mailto:iletisim@novera.example");
  await bubble.getByRole("button", { name: "Adresi kopyala" }).click();
  await expect(bubble.getByRole("button", { name: "Kopyalandı" })).toBeVisible();
  // The bubble stays inside the screen.
  const box = (await bubble.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.keyboard.press("Escape");
  await expect(bubble).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("a branch's e-mail is a choice too, and a click outside closes it", async ({ page }) => {
  await page.goto("/bayilerimiz");
  const first = page.getByRole("button", { name: "E-posta" }).first();
  await hydrated(first);
  await first.click();
  await expect(page.getByRole("group", { name: "E-posta adresi" })).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("group", { name: "E-posta adresi" })).toHaveCount(0);
});

test("a phone number offers to call or copy, like an e-mail address", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/iletisim");
  const phone = page.getByRole("button", { name: "+90 212 555 00 00" });
  await hydrated(phone);
  await phone.click();
  const bubble = page.getByRole("group", { name: "Telefon numarası" });
  await expect(bubble.getByRole("link", { name: "Ara" })).toHaveAttribute("href", "tel:+902125550000");
  await bubble.getByRole("button", { name: "Numarayı kopyala" }).click();
  await expect(bubble.getByRole("button", { name: "Kopyalandı" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bubble).toHaveCount(0);
});

test("a branch card's phone is a choice too", async ({ page }) => {
  await page.goto("/bayilerimiz");
  const call = page.getByRole("button", { name: /^Ara: / }).first();
  await hydrated(call);
  await call.click();
  await expect(page.getByRole("group", { name: "Telefon numarası" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Telefon numarası" }).getByRole("link", { name: "Ara" })).toHaveAttribute("href", /^tel:\+90/);
});
