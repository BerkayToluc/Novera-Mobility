import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { EMPLOYEE_LIST, EMPLOYEE_STATE_FILTERS, type EmployeeFilter, type FleetEmployee, type FleetEmployeePage } from "@/lib/fleet-panel";
import { getFleetEmployees } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.employees");
  return { title: t("title") };
}

export default async function FleetEmployeesPage({ searchParams }: PageProps<"/[locale]/filom/personel">) {
  const t = await getTranslations("FleetPanel.employees");
  const filterT = await getTranslations("FleetPanel.filter");
  const params = parseAdminListParams(await searchParams, EMPLOYEE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: FleetEmployeePage | null;
  try {
    data = await getFleetEmployees(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<EmployeeFilter>) => ({ pathname: "/filom/personel" as const, query: hrefQuery(params, patch, EMPLOYEE_LIST) });
  const columns: Column<FleetEmployee>[] = [
    {
      key: "lastName",
      header: t("columns.name"),
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{`${row.firstName} ${row.lastName}`}</span>
          {row.department && <span className="max-w-48 truncate text-small text-fg-muted">{row.department}</span>}
        </span>
      ),
    },
    { key: "employeeNo", header: t("columns.employeeNo"), cell: (row) => row.employeeNo ?? "—" },
    { key: "vehicle", header: t("columns.vehicle"), cell: (row) => row.vehicle?.plate ?? "—" },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.active ? "success" : "neutral"}>{row.active ? t("status.active") : t("status.inactive")}</StatusChip>,
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum);
  const newButton = (
    <Button asChild>
      <Link href="/filom/personel/yeni">{t("newButton")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...EMPLOYEE_STATE_FILTERS.map((value) => chip(value, t(`filters.${value}`)))]}
        />
        <SearchBox pathname="/filom/personel" query={hrefQuery(params, {}, EMPLOYEE_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/personel/[id]", params: { id: row.id } })}
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
