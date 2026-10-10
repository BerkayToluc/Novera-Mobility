import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProductBadge } from "@/components/product-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { isProductSlug, PRODUCTS } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/urunler/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isProductSlug(slug)) return {};
  const t = await getTranslations("ProductsPage");
  return pageMetadata({
    href: { pathname: "/urunler/[slug]", params: { slug } },
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.summary`),
  });
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/[locale]/urunler/[slug]">) {
  const { slug } = await params;
  if (!isProductSlug(slug)) notFound();

  const t = await getTranslations("ProductsPage");
  const featured = PRODUCTS.some((product) => product.slug === slug && product.featured);
  // The list of inclusions is content, so it sits in the message files with the rest of the text.
  const features = t.raw(`items.${slug}.features`) as string[];

  return (
    <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-20">
      <Button asChild variant="ghost" className="-ml-3 mb-6">
        <Link href="/urunler">← {t("backToList")}</Link>
      </Button>

      <div className="grid gap-10 xl:grid-cols-[2fr_1fr] xl:gap-16">
        <article className="flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            {featured && <ProductBadge>{t("featuredBadge")}</ProductBadge>}
            <h1 className="text-h1 text-fg">{t(`items.${slug}.title`)}</h1>
            <p className="max-w-prose text-body text-fg-muted">{t(`items.${slug}.description`)}</p>
          </header>

          <section className="flex flex-col gap-4">
            <h2 className="text-h2 text-fg">{t("featuresHeading")}</h2>
            <ul className="flex max-w-prose flex-col gap-3 text-body text-fg">
              {features.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-h2 text-fg">{t("idealForHeading")}</h2>
            <p className="max-w-prose text-body text-fg">{t(`items.${slug}.idealFor`)}</p>
          </section>
        </article>

        {/* The quote link carries the product so the quote form (BACKLOG #32) can pre-fill it. */}
        <aside className="flex h-fit flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8 xl:sticky xl:top-8">
          <h2 className="text-h3 text-fg">{t("ctaTitle")}</h2>
          <p className="text-body text-fg-muted">{t("ctaText")}</p>
          <Button asChild size="lg">
            <Link href={{ pathname: "/kurumsal-teklif", query: { urun: slug } }}>{t("quoteButton")}</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
