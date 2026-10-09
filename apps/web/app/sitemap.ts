import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PRODUCTS } from "@/lib/products";
import { SITE_URL } from "@/lib/site-url";

type PublicHref = Parameters<typeof getPathname>[0]["href"];

// The pages a search engine should know about: those that read the same for everyone.
// Searches, bookings and account pages are left out.
const PUBLIC: PublicHref[] = [
  "/",
  "/araclarimiz",
  "/urunler",
  ...PRODUCTS.map((product) => ({ pathname: "/urunler/[slug]", params: { slug: product.slug } }) as const),
  "/hizmetler",
  "/hakkimizda",
  "/iletisim",
  "/kurumsal-teklif",
  "/kvkk",
  "/cerez-politikasi",
  "/kiralama-kosullari",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (href: PublicHref, locale: (typeof routing.locales)[number]) => {
    const path = getPathname({ href, locale });
    // The home page is just "/", with no trailing slash after the origin.
    return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  };

  return PUBLIC.flatMap((href) =>
    routing.locales.map((locale) => ({
      url: url(href, locale),
      // Each entry names its translation, so the two languages are not seen as duplicates.
      alternates: {
        languages: Object.fromEntries(routing.locales.map((other) => [other, url(href, other)])),
      },
    })),
  );
}
