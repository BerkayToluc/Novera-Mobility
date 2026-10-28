import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { BRAND_COLORS } from "@/lib/brand";

// The web manifest (SPEC §9): what the site is called when it is added to a home screen, and the
// icons it uses. A route handler has no request language to read, so it is always in the
// primary language; the installed app opens the home page, which then follows the visitor's own
// language choice.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "Metadata" });

  return {
    name: t("title"),
    short_name: "Novera",
    description: t("description"),
    lang: routing.defaultLocale,
    // `id` keeps the installed app the same app if `start_url` ever changes; `scope` is the whole site.
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.canvasLight,
    theme_color: BRAND_COLORS.brand,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
