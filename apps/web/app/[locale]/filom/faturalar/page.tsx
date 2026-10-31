import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getFleetInvoices } from "@/lib/fleet-server";
import { FLEET_INVOICE_LIST, INVOICE_STATUSES, invoiceTone, periodLabel, type Invoice, type InvoiceFilter, type InvoicePage } from "@/lib/invoices";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.invoices");
  return { title: t("title") };
}

export default async function FleetInvoicesPage({ searchParams }: PageProps<"/[locale]/filom/faturalar">) {
  const t = await getTranslations("FleetPanel.invoices");
  const statusT = await getTranslations("Admin.invoices.status");
  const filterT = await getTranslations("FleetPanel.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, FLEET_INVOICE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: InvoicePage | null;
  try {
    data = await getFleetInvoices(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<InvoiceFilter>) => ({ pathname: "/filom/faturalar" as const, query: hrefQuery(params, patch, FLEET_INVOICE_LIST) });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
  // The amounts are TRY whatever currency the account chose (FLEET.md §3.1), written in the visitor's number style.
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const columns: Column<Invoice>[] = [
    { key: "number", header: t("columns.number"), cell: (row) => row.number },
    { key: "period", header: t("columns.period"), sortable: true, cell: (row) => periodLabel(row.period, locale) },
    { key: "dueAt", header: t("columns.due"), sortable: true, cell: (row) => date.format(new Date(`${row.dueAt}T00:00:00Z`)) },
    { key: "total", header: t("columns.total"), sortable: true, align: "right", cell: (row) => money.format(row.total / 100) },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={invoiceTone(row.status)}>{statusT(row.status)}</StatusChip> },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.filters.durum);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <FilterChips
        label={t("statusFilterLabel")}
        current={params.filters.durum ?? ""}
        options={[chip("", filterT("all")), ...INVOICE_STATUSES.map((status) => chip(status, statusT(status)))]}
      />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/faturalar/[number]", params: { number: row.number } })}
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
