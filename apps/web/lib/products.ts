// The four products of SPEC §2.1 and Appendix A. Slugs double as message keys under
// "ProductsPage.items" and as the URL segment, so adding a product means adding one entry
// here and its texts in both message files. The old slugs are gone with the old content;
// the site is not live, so there is nothing to redirect (SPEC §2.5).
export const PRODUCTS = [
  { slug: "akilli-kurumsal-filo", featured: true },
  { slug: "vip-mobilite", featured: false },
  { slug: "esnek-kisa-donem", featured: false },
  { slug: "yesil-filo", featured: false },
] as const;

export type ProductSlug = (typeof PRODUCTS)[number]["slug"];

export function isProductSlug(value: string): value is ProductSlug {
  return PRODUCTS.some((product) => product.slug === value);
}
