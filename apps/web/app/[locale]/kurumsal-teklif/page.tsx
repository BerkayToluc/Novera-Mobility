import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QuoteForm } from "@/components/quote/quote-form";
import { parseQuotePrefill } from "@/lib/quote-prefill";

const STEPS = ["received", "review", "offer"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("QuotePage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function CorporateQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("QuotePage");
  const initial = parseQuotePrefill(await searchParams);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <div className="rounded-card border border-border bg-surface p-6 md:p-8">
          <QuoteForm initial={initial} />
        </div>

        <aside aria-labelledby="quote-steps" className="flex flex-col gap-4 rounded-card bg-surface-muted p-6">
          <h2 id="quote-steps" className="text-h3 text-fg">
            {t("stepsTitle")}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-fg-muted">
            {STEPS.map((step) => (
              <li key={step}>{t(`steps.${step}`)}</li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
