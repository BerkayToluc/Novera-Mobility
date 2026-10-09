// The four fleet solutions of SPEC §2.1. Slugs double as message keys under
// "ProductsPage.items" and as the URL segment, so adding a product means adding
// one entry here and its texts in both message files.
export const PRODUCTS = [
  { slug: "uzun-donem", featured: true },
  { slug: "esnek-filo", featured: false },
  { slug: "elektrikli", featured: false },
  { slug: "yonetilen-filo", featured: false },
] as const;

export type ProductSlug = (typeof PRODUCTS)[number]["slug"];

export function isProductSlug(value: string): value is ProductSlug {
  return PRODUCTS.some((product) => product.slug === value);
}
