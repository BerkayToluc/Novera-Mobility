import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { InvoiceSheet } from "@/components/invoice/invoice-sheet";
import { PrintButton } from "@/components/invoice/print-button";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getFleetInvoice } from "@/lib/fleet-server";
import type { Invoice } from "@/lib/invoices";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.invoice");
  return { title: t("metaTitle") };
}

export default async function FleetInvoicePage({ params }: PageProps<"/[locale]/filom/faturalar/[number]">) {
  const t = await getTranslations("FleetPanel.invoice");
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. An invoice that does not exist, or is another company's, is a page that does not exist.
  let invoice: Invoice | null;
  let failed = false;
  try {
    invoice = await getFleetInvoice(number);
  } catch {
    invoice = null;
    failed = true;
  }
  if (!invoice && !failed) notFound();

  if (!invoice) {
    return (
      <>
        <PageHeader title={t("metaTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/filom/faturalar/[number]", params: { number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={invoice.number} description={t("intro")} action={<PrintButton />} />
      </div>
      <Button asChild variant="outline" className="self-start print:hidden">
        <Link href="/filom/faturalar">{t("back")}</Link>
      </Button>
      <InvoiceSheet invoice={invoice} />
    </>
  );
}
