import { GUIDES } from "./guides";
import { PRODUCTS } from "./products";
import type { PageHref } from "./seo";

// The pages that read the same for everyone and belong in search engines (ARCHITECTURE ADR-18):
// the one list the sitemap and `llms.txt` both draw from, so the two cannot drift. Searches,
// bookings and account pages are left out.
export const PUBLIC_PAGES: PageHref[] = [
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
  "/gizlilik-politikasi",
  "/cerez-politikasi",
  "/kullanim-sartlari",
  "/kiralama-kosullari",
];
