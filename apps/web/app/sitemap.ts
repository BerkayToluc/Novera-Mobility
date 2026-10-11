import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { GUIDES } from "@/lib/guides";
import { PRODUCTS } from "@/lib/products";
import { localizedUrl, type PageHref } from "@/lib/seo";

// The pages a search engine should know about: those that read the same for everyone.
// Searches, bookings and account pages are left out.
const PUBLIC: PageHref[] = [
  "/",
  "/araclarimiz",
  "/urunler",
  ...PRODUCTS.map((product) => ({ pathname: "/urunler/[slug]", params: { slug: product.slug } }) as const),
  "/hizmetler",
  "/hakkimizda",
  "/iletisim",
  "/yardim",
  "/rehberler",
  ...GUIDES.map((slug) => ({ pathname: "/rehberler/[slug]", params: { slug } }) as const),
  "/kurumsal-teklif",
  "/kvkk",
  "/cerez-politikasi",
  "/kiralama-kosullari",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC.flatMap((href) =>
    routing.locales.map((locale) => ({
      url: localizedUrl(href, locale),
      // Each entry names its translation, so the two languages are not seen as duplicates.
      alternates: {
        languages: Object.fromEntries(routing.locales.map((other) => [other, localizedUrl(href, other)])),
      },
    })),
  );
}
