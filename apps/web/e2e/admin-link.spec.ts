import { expect, test } from "./fixtures";
import { signInSample } from "./mock-session";

// The way into the panel (V2-23): only an administrator's profile has it. The panel itself comes in V2-24, and the API
// checks the role on every call, so this is a way in and not the protection (ADR-24).
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "novera-consent", value: encodeURIComponent('{"v":1,"analytics":false}'), url: "http://localhost:3200" },
  ]);
});

test("a customer's profile has no way into the panel", async ({ page, context }) => {
  await signInSample(context, "individual");
  await page.goto("/profil");
  await expect(page.getByRole("navigation", { name: "Profil bölümleri" }).getByRole("link", { name: "Hesabım" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Yönetim paneli" })).toHaveCount(0);
});

test("an administrator's profile has it, in Turkish and in English", async ({ page, context }) => {
  await signInSample(context, "admin");
  await page.goto("/profil");
  const nav = page.getByRole("navigation", { name: "Profil bölümleri" });
  await expect(nav.getByRole("link", { name: "Yönetim paneli" })).toHaveAttribute("href", "/yonetim");

  await page.goto("/en/profile");
  await expect(
    page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name: "Admin panel" }),
  ).toHaveAttribute("href", "/en/admin");
});
