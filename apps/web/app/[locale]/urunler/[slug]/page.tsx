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
    description: t(`items.${slug}.concept`),
  });
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/[locale]/urunler/[slug]">) {
  const { slug } = await params;
  if (!isProductSlug(slug)) notFound();

  const t = await getTranslations("ProductsPage");
  const featured = PRODUCTS.some((product) => product.slug === slug && product.featured);
  // The technology points are content, so they sit in the message files with the rest of the text.
  // A point may have a bold lead ("Novera Admin Paneli Dahil") before its sentence.
  const points = t.raw(`items.${slug}.tech.points`) as { title?: string; text: string }[];
  const techNote = t.has(`items.${slug}.tech.note`) ? t(`items.${slug}.tech.note`) : null;

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
          </header>

          <section className="flex flex-col gap-4">
            <h2 className="text-h2 text-fg">{t("conceptHeading")}</h2>
            <p className="max-w-prose text-body text-fg">{t(`items.${slug}.concept`)}</p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-h2 text-fg">{t("whatYouGetHeading")}</h2>
            <p className="max-w-prose text-body text-fg">{t(`items.${slug}.whatYouGet`)}</p>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-h2 text-fg">{t("techHeading")}</h2>
              {techNote && <p className="text-small text-fg-muted">{techNote}</p>}
            </div>
            <ul className="flex max-w-prose flex-col gap-3 text-body text-fg">
              {points.map((point) => (
                <li key={point.title ?? point.text} className="flex gap-3">
                  <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    {point.title && <strong className="font-semibold">{point.title}: </strong>}
                    {point.text}
                  </span>
                </li>
              ))}
            </ul>
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
