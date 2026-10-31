import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InvoicePaidAction } from "@/components/admin/invoice-paid-action";
import { PageHeader } from "@/components/admin/page-header";
import { InvoiceSheet } from "@/components/invoice/invoice-sheet";
import { PrintButton } from "@/components/invoice/print-button";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getAdminInvoice } from "@/lib/admin-server";
import type { Invoice } from "@/lib/invoices";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.invoices");
  return { title: t("detailTitle") };
}

export default async function InvoicePage({ params }: PageProps<"/[locale]/yonetim/faturalar/[number]">) {
  const t = await getTranslations("Admin.invoices");
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. An invoice that does not exist is a page that does not exist.
  let invoice: Invoice | null;
  let failed = false;
  try {
    invoice = await getAdminInvoice(number);
  } catch {
    invoice = null;
    failed = true;
  }
  if (!invoice && !failed) notFound();

  if (!invoice) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("detailErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/faturalar/[number]", params: { number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={invoice.number} description={t("detailIntro", { company: invoice.company.name })} action={<PrintButton />} />
      </div>
      <Button asChild variant="outline" className="self-start print:hidden">
        <Link href="/yonetim/faturalar">{t("back")}</Link>
      </Button>
      <InvoiceSheet invoice={invoice} />
      <InvoicePaidAction invoice={invoice} />
    </>
  );
}
