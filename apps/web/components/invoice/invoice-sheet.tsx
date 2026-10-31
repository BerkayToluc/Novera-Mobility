import { getLocale, getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/admin/status-chip";
import { invoiceTone, periodLabel, type Invoice } from "@/lib/invoices";

// The invoice as a document (V2-37, docs/FLEET.md §4.1), for the customer's screen and the administrator's alike: who it is for, the
// month, the lines, the VAT and the total. It is a sample invoice, not a legal document, and says so on the page. The print rules in
// globals.css (`.invoice-sheet`) give it a page of its own without the site's header and footer.
export async function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  const t = await getTranslations("Admin.invoices.sheet");
  const productsT = await getTranslations("FleetPanel.contracts.products");
  const statusT = await getTranslations("Admin.invoices.status");
  const locale = await getLocale();

  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const paidOn = invoice.paidAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(invoice.paidAt)) : null;
  const facts: Array<[string, string]> = [
    [t("number"), invoice.number],
    [t("period"), periodLabel(invoice.period, locale)],
    [t("issued"), day(invoice.issuedAt)],
    [t("due"), day(invoice.dueAt)],
  ];

  return (
    <article aria-labelledby="invoice-title" className="invoice-sheet flex max-w-3xl flex-col gap-6 rounded-card border border-border bg-surface p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="invoice-title" className="text-h2 text-fg">
            {t("title")}
          </h2>
          <p className="text-small text-fg-muted">{t("issuer")}</p>
        </div>
        <StatusChip tone={invoiceTone(invoice.status)}>{statusT(invoice.status)}</StatusChip>
      </header>

      <dl className="grid gap-3 md:grid-cols-2">
        <div>
          <dt className="text-small text-fg-muted">{t("billTo")}</dt>
          <dd className="break-words text-body text-fg">{invoice.company.name}</dd>
        </div>
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-small text-fg-muted">{term}</dt>
            <dd className="text-body text-fg">{value}</dd>
          </div>
        ))}
        {paidOn && (
          <div>
            <dt className="text-small text-fg-muted">{t("paidOn")}</dt>
            <dd className="text-body text-fg">{paidOn}</dd>
          </div>
        )}
      </dl>

      <div>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t("linesCaption")}</caption>
          <thead>
            <tr className="border-b border-border-strong text-small text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-normal">
                {t("contract")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                {t("days")}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.contractNumber} className="border-b border-border align-top">
                <th scope="row" className="py-3 pr-3 text-left text-body font-normal text-fg">
                  {line.contractNumber}
                  <span className="block text-small text-fg-muted">{productsT(line.productSlug as "akilli-kurumsal-filo")}</span>
                </th>
                <td className="py-3 pr-3 text-right text-body tabular-nums text-fg">{t("daysValue", { days: line.days, total: line.daysInMonth })}</td>
                <td className="py-3 text-right text-body tabular-nums text-fg">{money.format(line.amount / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2">
        <dt className="text-body text-fg-muted">{t("subtotal")}</dt>
        <dd className="text-right text-body tabular-nums text-fg">{money.format(invoice.subtotal / 100)}</dd>
        <dt className="text-body text-fg-muted">{t("vat", { percent: invoice.vatPercent })}</dt>
        <dd className="text-right text-body tabular-nums text-fg">{money.format(invoice.vat / 100)}</dd>
        <dt className="border-t border-border-strong pt-2 text-label text-fg">{t("total")}</dt>
        <dd className="border-t border-border-strong pt-2 text-right text-label tabular-nums text-fg">{money.format(invoice.total / 100)}</dd>
      </dl>

      <p className="text-small text-fg-muted">{t("note")}</p>
    </article>
  );
}
