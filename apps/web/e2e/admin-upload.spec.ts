import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// The photo upload of the panel (V2-28, ARCHITECTURE ADR-28) on the gallery's photo field, in sample mode: what the field sends,
// what the server makes of it, and what is refused. The sample photo store (mocks/uploads.ts) stands in for Vercel Blob; the
// server's checks themselves are tested on pictures made on the spot in tests/image-process.test.ts.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const plain = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#3a7a52" } });

// A photo of about the given size in bytes: noise does not compress, so its size follows its dimensions; the width is adjusted
// until the file is near the size asked for.
async function photoOfAbout(bytes: number): Promise<Buffer> {
  let width = 1700;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const height = Math.round((width * 2) / 3);
    const raw = randomBytes(width * height * 3);
    const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
    if (Math.abs(jpeg.length - bytes) < bytes * 0.06) return jpeg;
    width = Math.round(width * Math.sqrt(bytes / jpeg.length));
  }
  throw new Error("could not make a photo of the size asked for");
}

const field = (page: Page) => page.getByLabel("Fotoğraf", { exact: true });

async function open(page: Page, context: import("@playwright/test").BrowserContext, who: "admin" | "individual" = "admin") {
  await signInSample(context, who);
  await page.goto("/dev/admin");
  return hydrated(field(page));
}

test("a photo is uploaded, made 2000 px or less, turned into WebP, without what the camera wrote, and shown from where it is stored", async ({ page, context }) => {
  const input = await open(page, context);
  const withExif = await plain(2400, 1500).jpeg().withExif({ IFD0: { Copyright: "Gizli Sahip", Software: "Kamera 9" } }).toBuffer();
  await input.setInputFiles({ name: "arac.jpg", mimeType: "image/jpeg", buffer: withExif });

  await expect(page.getByRole("status").filter({ hasText: "Yüklendi" })).toBeVisible();
  const address = (await page.getByText(/Yüklenen adres: /).textContent())!.replace("Yüklenen adres: ", "").trim();
  expect(address).toMatch(/^\/mock-uploads\/[0-9a-f-]{36}\.webp$/);
  // The form carries the address of the stored picture, not the file.
  await expect(page.locator('input[type="hidden"][name="photo"]')).toHaveValue(address);
  await expect(input).not.toHaveAttribute("name", /.+/);

  // The picture on screen is the stored one, and it loads.
  const preview = page.getByRole("img").filter({ has: page.locator(`[src="${address}"]`) }).or(page.locator(`img[src="${address}"]`));
  await expect(preview.first()).toBeVisible();
  // The element is there before the picture has loaded, so it is waited for.
  await expect.poll(() => page.locator(`img[src="${address}"]`).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  // What was stored: WebP, at most 2000 wide, no EXIF, and not the name the browser gave.
  const stored = await page.request.get(address);
  expect(stored.status()).toBe(200);
  expect(stored.headers()["content-type"]).toBe("image/webp");
  const body = await stored.body();
  const meta = await sharp(body).metadata();
  expect(meta).toMatchObject({ format: "webp", width: 2000, height: 1250 });
  expect(meta.exif).toBeUndefined();
  expect(body.includes(Buffer.from("Gizli Sahip"))).toBe(false);
  expect(address).not.toContain("arac");
});

test("a photo of 4.5 MB, which the host would refuse as it is, goes through because the browser makes it smaller first", async ({ page, context }) => {
  const input = await open(page, context);
  const big = await photoOfAbout(4.7 * 1024 * 1024);
  // Over what the server takes (4 MB) and under what a person may choose (5 MB): the case this exists for.
  expect(big.length).toBeGreaterThan(4 * 1024 * 1024);
  expect(big.length).toBeLessThan(5 * 1024 * 1024);

  await input.setInputFiles({ name: "telefon.jpg", mimeType: "image/jpeg", buffer: big });
  await expect(page.getByRole("status").filter({ hasText: "Yüklendi" })).toBeVisible({ timeout: 30_000 });
  const address = (await page.getByText(/Yüklenen adres: /).textContent())!.replace("Yüklenen adres: ", "").trim();
  const meta = await sharp(await (await page.request.get(address)).body()).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.width).toBeLessThanOrEqual(2000);
  expect(meta.width).toBeGreaterThanOrEqual(1200);
});

test("a file that is not a picture is refused, whatever its name or type says", async ({ page, context }) => {
  const input = await open(page, context);
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n".repeat(40));
  await input.setInputFiles({ name: "sahte.jpg", mimeType: "image/jpeg", buffer: pdf });
  await expect(page.getByText("Bu dosya türü kabul edilmiyor.")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/Yüklenen adres/)).toHaveCount(0);
  await expect(page.getByText("Dosya seçilmedi")).toBeVisible();
});

test("a picture narrower than 1200 px is refused in words that say the width, and nothing is stored", async ({ page, context }) => {
  const input = await open(page, context);
  await input.setInputFiles({ name: "dar.png", mimeType: "image/png", buffer: await plain(800, 600).png().toBuffer() });
  await expect(page.getByText("Fotoğrafın genişliği en az 1200 piksel olmalı.")).toBeVisible();
  await expect(page.getByText(/Yüklenen adres/)).toHaveCount(0);
  await expect(page.locator('input[type="hidden"][name="photo"]')).toHaveValue("");
});

test("a file over 5 MB is refused at once, without being sent", async ({ page, context }) => {
  const input = await open(page, context);
  await input.setInputFiles({ name: "dev.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(6 * 1024 * 1024, 0xff) });
  await expect(page.getByText("Dosya 5 MB'tan büyük.")).toBeVisible();
  await expect(page.getByText(/Yüklenen adres/)).toHaveCount(0);
});

test("only an administrator can upload: with a customer's session the server says no and nothing is stored", async ({ page, context }) => {
  const input = await open(page, context, "individual");
  await input.setInputFiles({ name: "arac.jpg", mimeType: "image/jpeg", buffer: await plain(1600, 1000).jpeg().toBuffer() });
  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toBeVisible();
  await expect(page.getByText(/Yüklenen adres/)).toHaveCount(0);
});

test("removing the photo clears the address the form would send", async ({ page, context }) => {
  const input = await open(page, context);
  await input.setInputFiles({ name: "arac.jpg", mimeType: "image/jpeg", buffer: await plain(1600, 1000).jpeg().toBuffer() });
  await expect(page.getByRole("status").filter({ hasText: "Yüklendi" })).toBeVisible();
  await page.getByRole("button", { name: "Dosyayı kaldır" }).click();
  await expect(page.locator('input[type="hidden"][name="photo"]')).toHaveValue("");
  await expect(page.getByText(/Yüklenen adres/)).toHaveCount(0);
  await expect(page.getByText("Dosya seçilmedi")).toBeVisible();
});

test("choosing another photo replaces the first: the form carries the last one", async ({ page, context }) => {
  const input = await open(page, context);
  await input.setInputFiles({ name: "bir.jpg", mimeType: "image/jpeg", buffer: await plain(1600, 1000).jpeg().toBuffer() });
  await expect(page.getByRole("status").filter({ hasText: "Yüklendi" })).toBeVisible();
  const first = await page.locator('input[type="hidden"][name="photo"]').inputValue();
  await input.setInputFiles({ name: "iki.jpg", mimeType: "image/jpeg", buffer: await plain(1500, 1000).png().toBuffer() });
  await expect(page.getByText("iki.jpg")).toBeVisible();
  await expect(page.locator('input[type="hidden"][name="photo"]')).not.toHaveValue(first);
  await expect(page.locator('input[type="hidden"][name="photo"]')).not.toHaveValue("");
});

test("the picture store of the sample mode serves only what was uploaded, and nothing else", async ({ request }) => {
  expect((await request.get("/mock-uploads/00000000-0000-0000-0000-000000000000.webp")).status()).toBe(404);
  expect((await request.get("/mock-uploads/..%2f..%2fpackage.json")).status()).toBe(404);
});

test("the English field says the same in English", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/en/dev/admin");
  const input = await hydrated(page.getByLabel("Photo", { exact: true }));
  await expect(page.getByText("It has to be at least 1200 pixels wide.")).toBeVisible();
  await input.setInputFiles({ name: "narrow.png", mimeType: "image/png", buffer: await plain(800, 600).png().toBuffer() });
  await expect(page.getByText("The photo has to be at least 1200 pixels wide.")).toBeVisible();
  await input.setInputFiles({ name: "wide.jpg", mimeType: "image/jpeg", buffer: await plain(1600, 1000).jpeg().toBuffer() });
  await expect(page.getByRole("status").filter({ hasText: "Uploaded." })).toBeVisible();
});
