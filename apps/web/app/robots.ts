import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site-url";

// Pages behind an account or built from one visitor's choices have nothing to index. The
// search results and car pages say so themselves (noindex); a /araclar prefix here would
// also hide /araclarimiz, so they are not listed.
const PRIVATE = [
  "/profil",
  "/odeme",
  "/rezervasyon",
  "/giris",
  "/kayit",
  "/sifre-sifirla",
] as const;

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api/",
    ...routing.locales.flatMap((locale) => PRIVATE.map((href) => getPathname({ href, locale }))),
  ];
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...new Set(disallow)] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
