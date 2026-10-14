import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QuoteForm } from "@/components/quote/quote-form";
import { ProductArt } from "@/components/products/product-art";
import { QuoteSteps } from "@/components/quote/quote-steps";
import { Link } from "@/i18n/navigation";
import { isProductSlug } from "@/lib/products";
import { productFromParams } from "@/lib/quote";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("QuotePage");
  return pageMetadata({ href: "/kurumsal-teklif", title: t("metaTitle"), description: t("metaDescription") });
}

// The same corporate request as the home page's box (BACKLOG Y16), reached from a product's
// "Teklif Al" with that product already chosen (?urun=).
export default async function CorporateQuotePage({ searchParams }: PageProps<"/[locale]/kurumsal-teklif">) {
  const t = await getTranslations("QuotePage");
  const p = await getTranslations("ProductsPage");
  const product = productFromParams(await searchParams);

  // One centred column: the form is the page, so it is not pushed to the left of a wide empty area.
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {/* The product that was chosen on its page, kept in sight above the form (SPEC §2.2.3, v0.9). */}
      {isProductSlug(product) && (
        <section aria-label={t("chip.label")} className="flex flex-col gap-2 rounded-card bg-surface-muted p-4 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ProductArt slug={product} className="size-14 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <p className="text-small text-fg-muted">{t("chip.label")}</p>
              <p className="text-label text-fg">{p(`items.${product}.title`)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4">
            <Link
              href={{ pathname: "/urunler/[slug]", params: { slug: product } }}
              className="inline-flex min-h-11 items-center text-label text-link underline underline-offset-4"
            >
              {t("chip.view")}
            </Link>
            <Link href="/kurumsal-teklif" className="inline-flex min-h-11 items-center text-label text-fg-muted underline underline-offset-4">
              {t("chip.remove")}
            </Link>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-8 rounded-card border border-border bg-surface p-6 md:p-8">
        <QuoteSteps />
        <QuoteForm initialProduct={product} withProduct />
      </div>
    </div>
  );
}
