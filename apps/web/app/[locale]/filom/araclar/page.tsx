import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { VEHICLE_ASSIGN_FILTERS, VEHICLE_LIST, VEHICLE_STATUS_FILTERS, type FleetVehicle, type FleetVehiclePage, type VehicleFilter } from "@/lib/fleet-panel";
import { getFleetVehicles } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.vehicles");
  return { title: t("title") };
}

export default async function FleetVehiclesPage({ searchParams }: PageProps<"/[locale]/filom/araclar">) {
  const t = await getTranslations("FleetPanel.vehicles");
  const filterT = await getTranslations("FleetPanel.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, VEHICLE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: FleetVehiclePage | null;
  try {
    data = await getFleetVehicles(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<VehicleFilter>) => ({ pathname: "/filom/araclar" as const, query: hrefQuery(params, patch, VEHICLE_LIST) });
  const km = new Intl.NumberFormat(locale);
  const columns: Column<FleetVehicle>[] = [
    { key: "plate", header: t("columns.plate"), sortable: true, cell: (row) => row.plate },
    { key: "model", header: t("columns.model"), cell: (row) => `${row.model.brand} ${row.model.model}` },
    {
      key: "assignee",
      header: t("columns.assignee"),
      cell: (row) => (row.status === "RETURNED" ? "—" : row.assignee ? <span className="block max-w-40 truncate">{row.assignee.name}</span> : <span className="text-fg-muted">{t("idle")}</span>),
    },
    { key: "km", header: t("columns.km"), align: "right", cell: (row) => t("kmValue", { km: km.format(row.lastKm) }) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (name: VehicleFilter, value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum || params.filters.zimmet);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("durum", "", filterT("all")), ...VEHICLE_STATUS_FILTERS.map((value) => chip("durum", value, t(`filters.${value}`)))]}
        />
        <FilterChips
          label={t("assignFilterLabel")}
          current={params.filters.zimmet ?? ""}
          options={[chip("zimmet", "", filterT("all")), ...VEHICLE_ASSIGN_FILTERS.map((value) => chip("zimmet", value, t(`filters.${value}`)))]}
        />
        <SearchBox pathname="/filom/araclar" query={hrefQuery(params, {}, VEHICLE_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/araclar/[plate]", params: { plate: row.plate.replace(/ /g, "") } })}
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
      {data && <Pagination page={params.page} pageSize={params.pageSize} total={data.total} hrefFor={(page) => address({ page })} />}
    </>
  );
}
