import type { BrowserContext } from "@playwright/test";

// The sample mode asks for a signed-in visitor before payment, like the real site (ADR-29, QUALITY G-06). Tests that are
// not about signing in carry the sample session cookie instead of walking through the form; the sign-in itself is
// covered in forms-account.spec.ts and points.spec.ts.
export async function signInSample(context: BrowserContext, who: "individual" | "corporate" | "admin" = "individual") {
  await context.addCookies([{ name: "novera-mock-session", value: who, url: "http://localhost:3200" }]);
}
