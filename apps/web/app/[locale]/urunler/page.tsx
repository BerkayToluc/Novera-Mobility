import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/product-card";
import { PRODUCTS } from "@/lib/products";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ProductsPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ProductsPage() {
  const t = await getTranslations("ProductsPage");
  const featured = PRODUCTS.find((product) => product.featured);
  const others = PRODUCTS.filter((product) => !product.featured);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-10 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-6">
        {featured && <ProductCard slug={featured.slug} featured />}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {others.map((product) => (
            <ProductCard key={product.slug} slug={product.slug} />
          ))}
        </div>
      </div>
    </div>
  );
}
