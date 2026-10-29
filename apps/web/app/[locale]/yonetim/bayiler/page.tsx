import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CityFilter } from "@/components/admin/city-filter";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { BRANCH_LIST, BRANCH_STATUSES, type AdminBranch, type AdminBranchPage } from "@/lib/admin-branches";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminBranches } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.branches");
  return { title: t("title") };
}

export default async function BranchesPage({ searchParams }: PageProps<"/[locale]/yonetim/bayiler">) {
  const t = await getTranslations("Admin.branches");
  const filterT = await getTranslations("Admin.filter");
  const params = parseAdminListParams(await searchParams, BRANCH_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminBranchPage | null;
  try {
    data = await getAdminBranches(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<"sehir" | "durum">) => ({ pathname: "/yonetim/bayiler" as const, query: hrefQuery(params, patch, BRANCH_LIST) });
  const columns: Column<AdminBranch>[] = [
    { key: "name", header: t("columns.name"), sortable: true, cell: (row) => row.name },
    { key: "city", header: t("columns.city"), sortable: true, cell: (row) => row.city },
    { key: "kind", header: t("columns.kind"), cell: (row) => t(`kind.${row.kind}`) },
    { key: "activeVehicles", header: t("columns.vehicles"), sortable: true, align: "right", cell: (row) => String(row.activeVehicles) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "OPEN" ? "success" : "neutral"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum || params.filters.sehir);
  const newButton = (
    <Button asChild>
      <Link href="/yonetim/bayiler/yeni">{t("newButton")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("filterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...BRANCH_STATUSES.map((status) => chip(status, t(`status.${status}`)))]}
        />
        <CityFilter pathname="/yonetim/bayiler" query={hrefQuery(params, {}, BRANCH_LIST)} name="sehir" value={params.filters.sehir ?? ""} label={t("cityFilterLabel")} />
        <SearchBox pathname="/yonetim/bayiler" query={hrefQuery(params, {}, BRANCH_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/bayiler/[id]", params: { id: row.id } })}
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
