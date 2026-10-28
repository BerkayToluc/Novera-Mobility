import { expect, test } from "./fixtures";
import { hydrated } from "./hydration";

// The branches page (SPEC §2.6.1): open or closed on each card, rent from here, nearest first, kinds.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

const cards = (page: import("@playwright/test").Page) => page.locator("article");

test("every card says whether the branch is open now", async ({ page }) => {
  await page.goto("/bayilerimiz");
  await expect(cards(page).first()).toBeVisible();
  // The words are read in the browser, so they are there once the page is.
  await expect.poll(() => cards(page).filter({ hasText: /7\/24 açık|Şu an açık|Kapalı ·/ }).count()).toBe(15);
  // Airports never close, city offices have hours.
  await expect(cards(page).filter({ hasText: "İstanbul Havalimanı" }).getByText("7/24 açık").first()).toBeVisible();
});

test("the heading is centred over the fields", async ({ page }) => {
  await page.goto("/bayilerimiz");
  // The boxes are read once the elements are on screen: the box of one that is not there yet is `null`.
  const title = page.getByRole("heading", { level: 1, name: "Bayilerimiz" });
  const city = page.getByRole("button", { name: "Şehir", exact: true });
  await expect(title).toBeVisible();
  await expect(city).toBeVisible();
  const heading = await title.boundingBox();
  const field = await city.boundingBox();
  const viewport = page.viewportSize()!;
  expect(heading && field).toBeTruthy();
  // The heading's middle is the middle of the page.
  expect(Math.abs(heading!.x + heading!.width / 2 - viewport.width / 2)).toBeLessThan(24);
});

test("the kind chips narrow the list to airports or city offices", async ({ page }) => {
  await page.goto("/bayilerimiz");
  const kinds = page.getByRole("group", { name: "Bayi türü" });
  await expect(kinds.getByRole("button", { name: /^Tümü/ })).toHaveAttribute("aria-pressed", "true");

  await (await hydrated(kinds.getByRole("button", { name: /^Havalimanı/ }))).click();
  await expect(kinds.getByRole("button", { name: /^Havalimanı/ })).toHaveAttribute("aria-pressed", "true");
  const airports = await cards(page).count();
  expect(airports).toBeGreaterThan(0);
  expect(airports).toBeLessThan(15);
  await expect(cards(page).filter({ hasNotText: "Havalimanı" })).toHaveCount(0);

  await (await hydrated(kinds.getByRole("button", { name: /^Şehir merkezi/ }))).click();
  await expect(cards(page).filter({ hasText: "Havalimanı" })).toHaveCount(0);
  expect((await cards(page).count()) + airports).toBe(15);

  await (await hydrated(kinds.getByRole("button", { name: /^Tümü/ }))).click();
  await expect(cards(page)).toHaveCount(15);
});

test("nearest first: the cards are ordered by distance and say how far each is", async ({ page, context }) => {
  // A spot in Izmir.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 38.42, longitude: 27.14 });
  await page.goto("/bayilerimiz");
  await (await hydrated(page.getByRole("button", { name: "Bana en yakın bayiler" }))).click();

  await expect(page.getByText("Bayiler size en yakından başlayarak sıralandı.")).toBeVisible();
  // Izmir's own branch comes first and the km grow down the list.
  await expect(cards(page).first()).toContainText("İzmir");
  const kms = await cards(page).evaluateAll((nodes) =>
    nodes.map((node) => Number(/yaklaşık (\d+) km/.exec(node.textContent ?? "")?.[1])),
  );
  expect(kms.length).toBe(15);
  expect(kms.every((value, index) => index === 0 || value >= kms[index - 1])).toBe(true);

  await (await hydrated(page.getByRole("button", { name: "Sıralamayı kaldır" }))).click();
  await expect(page.getByText(/yaklaşık \d+ km/)).toHaveCount(0);
});

test("nearest first says so when the position is refused, and the list stays as it was", async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto("/bayilerimiz");
  await (await hydrated(page.getByRole("button", { name: "Bana en yakın bayiler" }))).click();
  await expect(page.getByText(/Konum izni verilmedi|Konumunuz alınamadı/)).toBeVisible();
  await expect(cards(page)).toHaveCount(15);
});

test("Buradan kirala opens the rental box with that branch chosen as pick-up and return", async ({ page }) => {
  await page.goto("/bayilerimiz");
  const card = cards(page).filter({ hasText: "Esenboğa" });
  await (await hydrated(card.getByRole("link", { name: /Buradan kirala/ }))).click();
  await expect(page).toHaveURL(/\/\?alis=ankara-esenboga#kiralama/);
  await expect(page.getByRole("combobox", { name: "Alış bayisi" })).toContainText("Ankara · Esenboğa");
  await expect(page.getByRole("combobox", { name: "Bırakacağınız bayi" })).toContainText("Ankara · Esenboğa");
});

test("a branch in the address that does not exist is ignored", async ({ page }) => {
  await page.goto("/?alis=yok-boyle-bayi");
  await expect(page.getByRole("combobox", { name: "Alış bayisi" })).toContainText("Bayi seçin");
});
