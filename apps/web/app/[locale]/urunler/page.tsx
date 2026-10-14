import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductTile } from "@/components/products/product-tile";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PRODUCTS } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ProductsPage");
  return pageMetadata({ href: "/urunler", title: t("metaTitle"), description: t("metaDescription") });
}

// The products (SPEC §2.5): four cards on their own washes. The most chosen one comes first across
// the full width, the other three below it (three in a row from xl; on a tablet the last one takes
// the whole row rather than sitting alone); then a word for anyone who cannot decide, pointing to the quote form.
export default async function ProductsPage() {
  const t = await getTranslations("ProductsPage");
  const ordered = [...PRODUCTS].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-8 xl:gap-16 xl:py-20">
      <header className="flex max-w-2xl flex-col gap-4">
        <p className="text-label text-link">{t("eyebrow")}</p>
        <h1 className="text-display text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("intro")}</p>
      </header>

      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        {ordered.map((product) => (
          <li
            key={product.slug}
            className={product.featured ? "grid md:col-span-2 xl:col-span-3" : "grid md:last:col-span-2 xl:last:col-span-1"}
          >
            <ProductTile slug={product.slug} size={product.featured ? "large" : "default"} />
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="products-help"
        className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-10"
      >
        <div className="flex max-w-prose flex-col gap-2">
          <h2 id="products-help" className="text-h2 text-fg">
            {t("helpTitle")}
          </h2>
          <p className="text-body text-fg-muted">{t("helpText")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/kurumsal-teklif">{t("helpButton")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={{ pathname: "/iletisim", hash: "mesaj" }}>{t("helpContact")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
