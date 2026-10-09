import { getTranslations } from "next-intl/server";
import { AudienceSwitch } from "@/components/home/audience-switch";
import { ClassHighlights } from "@/components/home/class-highlights";
import { CorporateQuoteForm } from "@/components/home/corporate-quote-form";
import { FaqSection } from "@/components/home/faq-section";
import { GuaranteeBand } from "@/components/home/guarantee-band";
import { ProductCard } from "@/components/product-card";
import { RentalSearchForm } from "@/components/rental/rental-search-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { parseAudience } from "@/lib/audience";
import type { BranchOption } from "@/lib/branch-options";
import { getCurrency } from "@/lib/get-currency";
import { PRODUCTS } from "@/lib/products";
import { getBranchOptions } from "@/lib/rental-data";

export default async function Home({ searchParams }: PageProps<"/[locale]">) {
  const t = await getTranslations("HomePage");
  const audience = parseAudience((await searchParams).tip);
  const corporate = audience === "kurumsal";
  const currency = await getCurrency();

  // Only the fetch sits in the try: not reaching the branches is an expected state with its
  // own message, while a rendering bug should still reach the error boundary. The corporate
  // tab does not need branches.
  let branches: BranchOption[] | null = null;
  if (!corporate) {
    try {
      branches = await getBranchOptions(currency);
    } catch {
      branches = null;
    }
  }

  return (
    <>
      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-8 xl:gap-16 xl:py-20">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="text-display text-fg">{corporate ? t("corporateTitle") : t("title")}</h1>
            <p className="max-w-prose text-body text-fg-muted">
              {corporate ? t("corporateIntro") : t("intro")}
            </p>
          </header>

          <AudienceSwitch value={audience} />

          <div className="max-w-3xl rounded-card border border-border bg-surface p-6 md:p-8">
            {corporate ? (
              <CorporateQuoteForm />
            ) : branches ? (
              <RentalSearchForm branches={branches} />
            ) : (
              <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
                <Button asChild>
                  <Link href="/">{t("error.retry")}</Link>
                </Button>
              </StateMessage>
            )}
          </div>
        </div>

        {corporate ? (
          <section aria-labelledby="products-title" className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h2 id="products-title" className="text-h2 text-fg">
                {t("products.title")}
              </h2>
              <p className="max-w-prose text-body text-fg-muted">{t("products.intro")}</p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              {PRODUCTS.map((product) => (
                <ProductCard key={product.slug} slug={product.slug} headingAs="h3" />
              ))}
            </div>
            <Button asChild variant="outline" className="self-start">
              <Link href="/urunler">{t("products.viewAll")}</Link>
            </Button>
          </section>
        ) : (
          <ClassHighlights currency={currency} />
        )}
      </div>

      <GuaranteeBand />

      <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-20">
        <FaqSection audience={audience} />
      </div>
    </>
  );
}
