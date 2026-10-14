import { getTranslations } from "next-intl/server";
import { GradientCard } from "@/components/ui/gradient-card";
import { PRODUCTS, type ProductSlug } from "@/lib/products";
import { ProductArt } from "./product-art";

// A product as a card on its own wash (GradientCard): the badge, the short line, its drawing.
export async function ProductTile({
  slug,
  size,
  headingAs = "h2",
}: {
  slug: ProductSlug;
  size?: "default" | "large";
  headingAs?: "h2" | "h3";
}) {
  const t = await getTranslations("ProductsPage");
  const product = PRODUCTS.find((entry) => entry.slug === slug)!;
  return (
    <GradientCard
      href={{ pathname: "/urunler/[slug]", params: { slug } }}
      tone={product.tone}
      size={size}
      badge={t(`items.${slug}.badge`)}
      badgeDot={product.featured ? "accent" : "primary"}
      title={t(`items.${slug}.title`)}
      description={t(`items.${slug}.tagline`)}
      cta={t("open")}
      art={<ProductArt slug={slug} className="w-full" />}
      headingAs={headingAs}
    />
  );
}
