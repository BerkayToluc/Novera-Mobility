import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { QuoteEditor } from "@/components/admin/quote-editor";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminQuoteDetail } from "@/lib/admin-quotes";
import { getAdminQuote } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.quotes");
  return { title: t("detailTitle") };
}

export default async function QuotePage({ params }: PageProps<"/[locale]/yonetim/teklifler/[number]">) {
  const t = await getTranslations("Admin.quotes");
  const locale = await getLocale();
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still
  // reach the segment's error boundary. A request that does not exist is a page that does not exist.
  let quote: AdminQuoteDetail | null;
  let failed = false;
  try {
    quote = await getAdminQuote(number);
  } catch {
    quote = null;
    failed = true;
  }
  if (!quote && !failed) notFound();

  if (!quote) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/teklifler/[number]", params: { number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const erased = t("erased");
  const facts: Array<[string, string]> = [
    [t("facts.company"), quote.companyName],
    [t("facts.contact"), quote.anonymized ? erased : (quote.contactName ?? "—")],
    [t("facts.email"), quote.anonymized ? erased : quote.email],
    [t("facts.phone"), quote.anonymized ? erased : (quote.phone ?? "—")],
    [t("facts.fleet"), t("fleet", { vehicles: quote.vehicleCount, months: quote.durationMonths })],
    [t("facts.vehicleType"), quote.vehicleType],
    [t("facts.cities"), quote.deliveryCities ?? "—"],
    [t("facts.source"), t(`source.${quote.source}`)],
    [t("facts.account"), quote.account ? quote.account.email : t("noAccount")],
    [t("facts.created"), dateTime.format(new Date(quote.createdAt))],
  ];

  return (
    <>
      <PageHeader
        title={quote.number}
        description={t("detailIntro", { company: quote.companyName })}
        action={<StatusChip tone={quote.status === "RECEIVED" ? "warning" : quote.status === "CLOSED" ? "neutral" : "success"}>{t(`state.${quote.status}`)}</StatusChip>}
      />

      <section aria-labelledby="quote-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="quote-facts" className="text-h3 text-fg">
          {t("facts.title")}
        </h2>
        <dl className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-small text-fg-muted">{term}</dt>
              <dd className="break-words text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        {quote.notes && (
          <div className="flex flex-col gap-1 rounded-card border border-border p-4">
            <p className="text-small text-fg-muted">{t("facts.customerNote")}</p>
            <p className="whitespace-pre-wrap break-words text-body text-fg">{quote.notes}</p>
          </div>
        )}
      </section>

      {/* Keyed by the version: after a save, or "load the current record", the editor starts again from what is stored. */}
      <QuoteEditor key={quote.updatedAt} quote={quote} />
    </>
  );
}
