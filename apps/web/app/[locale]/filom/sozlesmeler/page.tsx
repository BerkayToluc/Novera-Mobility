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
import { CONTRACT_LIST, CONTRACT_STATE_FILTERS, type ContractFilter, type FleetContract, type FleetContractPage } from "@/lib/fleet-panel";
import { getFleetContracts } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.contracts");
  return { title: t("title") };
}

export default async function FleetContractsPage({ searchParams }: PageProps<"/[locale]/filom/sozlesmeler">) {
  const t = await getTranslations("FleetPanel.contracts");
  const filterT = await getTranslations("FleetPanel.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, CONTRACT_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: FleetContractPage | null;
  try {
    data = await getFleetContracts(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<ContractFilter>) => ({ pathname: "/filom/sozlesmeler" as const, query: hrefQuery(params, patch, CONTRACT_LIST) });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
  // The amounts are TRY whatever currency the account chose (FLEET.md §3.1), written in the visitor's number style.
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const columns: Column<FleetContract>[] = [
    { key: "number", header: t("columns.number"), sortable: true, cell: (row) => row.number },
    { key: "product", header: t("columns.product"), cell: (row) => t(`products.${row.productSlug as "akilli-kurumsal-filo"}`) },
    { key: "endAt", header: t("columns.period"), sortable: true, cell: (row) => `${date.format(new Date(`${row.startAt}T00:00:00Z`))} – ${date.format(new Date(`${row.endAt}T00:00:00Z`))}` },
    { key: "fee", header: t("columns.fee"), align: "right", cell: (row) => money.format(row.monthlyFee / 100) },
    { key: "vehicles", header: t("columns.vehicles"), align: "right", cell: (row) => String(row.vehicleCount) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.filters.durum);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <FilterChips
        label={t("statusFilterLabel")}
        current={params.filters.durum ?? ""}
        options={[chip("", filterT("all")), ...CONTRACT_STATE_FILTERS.map((value) => chip(value, t(`status.${value}`)))]}
      />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/sozlesmeler/[number]", params: { number: row.number } })}
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
