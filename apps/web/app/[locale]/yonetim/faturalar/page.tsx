import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { InvoiceGenerator } from "@/components/admin/invoice-generator";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminInvoices } from "@/lib/admin-server";
import { currentTime } from "@/lib/clock";
import { ADMIN_INVOICE_LIST, INVOICE_STATUSES, billingPeriods, invoiceTone, periodLabel, type Invoice, type InvoiceFilter, type InvoicePage } from "@/lib/invoices";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.invoices");
  return { title: t("title") };
}

export default async function InvoicesPage({ searchParams }: PageProps<"/[locale]/yonetim/faturalar">) {
  const t = await getTranslations("Admin.invoices");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, ADMIN_INVOICE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: InvoicePage | null;
  try {
    data = await getAdminInvoices(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<InvoiceFilter>) => ({ pathname: "/yonetim/faturalar" as const, query: hrefQuery(params, patch, ADMIN_INVOICE_LIST) });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const columns: Column<Invoice>[] = [
    { key: "number", header: t("columns.number"), sortable: true, cell: (row) => row.number },
    { key: "company", header: t("columns.company"), cell: (row) => <span className="block max-w-56 truncate">{row.company.name}</span> },
    { key: "period", header: t("columns.period"), cell: (row) => periodLabel(row.period, locale) },
    { key: "issuedAt", header: t("columns.issued"), sortable: true, cell: (row) => date.format(new Date(`${row.issuedAt}T00:00:00Z`)) },
    { key: "dueAt", header: t("columns.due"), sortable: true, cell: (row) => date.format(new Date(`${row.dueAt}T00:00:00Z`)) },
    { key: "total", header: t("columns.total"), sortable: true, align: "right", cell: (row) => money.format(row.total / 100) },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={invoiceTone(row.status)}>{t(`status.${row.status}`)}</StatusChip> },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum);
  // This month and the eleven before it, in the reader's language; the month people usually bill is the one that has just ended.
  const periods = billingPeriods(new Date(currentTime()).toISOString().slice(0, 10)).map((value) => ({ value, label: periodLabel(value, locale) }));

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <InvoiceGenerator periods={periods} defaultPeriod={periods[0]!.value} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...INVOICE_STATUSES.map((status) => chip(status, t(`status.${status}`)))]}
        />
        <SearchBox pathname="/yonetim/faturalar" query={hrefQuery(params, {}, ADMIN_INVOICE_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/faturalar/[number]", params: { number: row.number } })}
        sort={params.sort}
        sortHref={(key, dir) => address({ sort: { key, dir } })}
        state={data ? "ready" : "error"}
        empty={filtered ? { title: t("emptyFilteredTitle"), text: t("emptyFilteredText") } : { title: t("emptyTitle"), text: t("emptyText") }}
        error={{
          title: t("loadErrorTitle"),
          text: t("loadErrorText"),
          action: (
            <Button asChild variant="outline">
              <Link href={address({})}>{t("retry")}</Link>
            </Button>
          ),
        }}
      />
      <p className="text-small text-fg-muted">{t("currencyNote")}</p>
      {data && <Pagination page={params.page} pageSize={params.pageSize} total={data.total} hrefFor={(page) => address({ page })} />}
    </>
  );
}
