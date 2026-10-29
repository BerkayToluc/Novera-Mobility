import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { SelectFilter } from "@/components/admin/select-filter";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminVehicles, getBranchOptions, getModelOptions } from "@/lib/admin-server";
import { VEHICLE_LIST, VEHICLE_STATUSES, type AdminVehicle, type AdminVehiclePage } from "@/lib/admin-vehicles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.vehicles");
  return { title: t("title") };
}

export default async function VehiclesPage({ searchParams }: PageProps<"/[locale]/yonetim/araclar">) {
  const t = await getTranslations("Admin.vehicles");
  const filterT = await getTranslations("Admin.filter");
  const params = parseAdminListParams(await searchParams, VEHICLE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI. The two choices only fill the
  // filters, so the list still shows when they are missing.
  let data: AdminVehiclePage | null;
  try {
    data = await getAdminVehicles(params);
  } catch {
    data = null;
  }
  const [models, branches] = await Promise.all([getModelOptions(true).catch(() => []), getBranchOptions(true).catch(() => [])]);

  const address = (patch: Patch<"model" | "bayi" | "durum">) => ({ pathname: "/yonetim/araclar" as const, query: hrefQuery(params, patch, VEHICLE_LIST) });
  const columns: Column<AdminVehicle>[] = [
    { key: "plate", header: t("columns.plate"), sortable: true, cell: (row) => row.plate },
    { key: "model", header: t("columns.model"), sortable: true, cell: (row) => `${row.model.brand} ${row.model.model}` },
    { key: "branch", header: t("columns.branch"), sortable: true, cell: (row) => row.branch.name },
    { key: "year", header: t("columns.year"), sortable: true, align: "right", cell: (row) => String(row.year) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum || params.filters.model || params.filters.bayi);
  const newButton = (
    <Button asChild>
      <Link href="/yonetim/araclar/yeni">{t("newButton")}</Link>
    </Button>
  );
  const baseQuery = hrefQuery(params, {}, VEHICLE_LIST);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...VEHICLE_STATUSES.map((status) => chip(status, t(`status.${status}`)))]}
        />
        <SelectFilter
          pathname="/yonetim/araclar"
          query={baseQuery}
          name="model"
          value={params.filters.model ?? ""}
          label={t("modelFilterLabel")}
          allLabel={t("allModels")}
          applyLabel={t("apply")}
          options={models.map((model) => ({ value: model.slug, label: model.label }))}
        />
        <SelectFilter
          pathname="/yonetim/araclar"
          query={baseQuery}
          name="bayi"
          value={params.filters.bayi ?? ""}
          label={t("branchFilterLabel")}
          allLabel={t("allBranches")}
          applyLabel={t("apply")}
          options={branches.map((branch) => ({ value: branch.id, label: branch.label }))}
        />
        <SearchBox pathname="/yonetim/araclar" query={baseQuery} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/araclar/[id]", params: { id: row.id } })}
        sort={params.sort}
        sortHref={(key, dir) => address({ sort: { key, dir } })}
        state={data ? "ready" : "error"}
        empty={filtered ? { title: t("emptyFilteredTitle"), text: t("emptyFilteredText") } : { title: t("emptyTitle"), text: t("emptyText"), action: newButton }}
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
