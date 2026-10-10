import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QuoteForm } from "@/components/quote/quote-form";
import { QuoteSteps } from "@/components/quote/quote-steps";
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
  const product = productFromParams(await searchParams);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex max-w-3xl flex-col gap-8 rounded-card border border-border bg-surface p-6 md:p-8">
        <QuoteSteps />
        <QuoteForm initialProduct={product} withProduct />
      </div>
    </div>
  );
}
