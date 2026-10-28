import { expect, test } from "@playwright/test";
import { hydrated } from "./hydration";
import { signInSample } from "./mock-session";

// V2-16 (QUALITY U-01..U-04, U-06): the corporate quote page can be reached from the menus, the two privacy pages
// point at one another, a booking card shows its car, and the web manifest has what a phone needs to install the site.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("the footer leads to the corporate quote page", async ({ page }) => {
  await page.goto("/hakkimizda");
  await page.getByRole("contentinfo").getByRole("link", { name: "Kurumsal teklif" }).click();
  await expect(page).toHaveURL(/\/kurumsal-teklif$/);
});

test("desktop: the Products list ends with a link to the quote page", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "the inline menu is the desktop layout");
  await page.goto("/");
  const products = page.getByRole("banner").getByRole("button", { name: "Ürünler" });
  await hydrated(products);
  await products.click();
  await page.getByRole("link", { name: "Teklif alın" }).click();
  await expect(page).toHaveURL(/\/kurumsal-teklif$/);
});

test("phone: the menu panel lists the quote page under Products", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1280, "the panel is the phone and tablet layout");
  await page.goto("/");
  const open = page.getByRole("button", { name: "Menüyü aç" });
  await hydrated(open);
  await open.click();
  await page.getByRole("dialog").getByRole("link", { name: "Teklif alın" }).click();
  await expect(page).toHaveURL(/\/kurumsal-teklif$/);
});

test("the KVKK notice and the privacy policy say what sets them apart and link to one another", async ({ page }) => {
  await page.goto("/kvkk");
  await expect(page.getByText(/hukuki aydınlatma metnidir/)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Gizlilik Politikası" }).click();
  await expect(page).toHaveURL(/\/gizlilik-politikasi$/);
  await expect(page.getByText(/sade bir dille anlatan özettir/)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "KVKK Aydınlatma Metni" }).click();
  await expect(page).toHaveURL(/\/kvkk$/);
});

test("the booking cards show the photo of the car", async ({ page, context }) => {
  await signInSample(context, "individual");
  await page.goto("/profil/rezervasyonlar");
  const photos = page.getByRole("main").locator("li img[src*='fleet']");
  await expect(photos.first()).toBeVisible();
  // A car with no photo in the sample data keeps the calm placeholder, so not every card has an image.
  expect(await photos.count()).toBeGreaterThanOrEqual(3);
});

test("the web manifest has the icons and the identity a phone needs", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: "/", scope: "/", start_url: "/", display: "standalone" });
  const icons = manifest.icons as { src: string; sizes: string; type: string; purpose?: string }[];
  expect(icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png")).toBe(true);
  expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
  expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
  for (const icon of icons.filter((entry) => entry.type === "image/png")) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"], icon.src).toContain("image/png");
  }
});
