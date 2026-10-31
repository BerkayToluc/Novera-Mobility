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
import { ASSIGNMENT_LIST, ASSIGNMENT_STATE_FILTERS, type AssignmentFilter, type FleetAssignment, type FleetAssignmentPage } from "@/lib/fleet-panel";
import { getFleetAssignments } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.assignments");
  return { title: t("title") };
}

// The history of who had which car (docs/FLEET.md §3): every assignment, the newest first. Giving a car and taking it back is done on the
// car's own page; this is the record.
export default async function FleetAssignmentsPage({ searchParams }: PageProps<"/[locale]/filom/zimmet">) {
  const t = await getTranslations("FleetPanel.assignments");
  const filterT = await getTranslations("FleetPanel.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, ASSIGNMENT_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: FleetAssignmentPage | null;
  try {
    data = await getFleetAssignments(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<AssignmentFilter>) => ({ pathname: "/filom/zimmet" as const, query: hrefQuery(params, patch, ASSIGNMENT_LIST) });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Istanbul" });
  const columns: Column<FleetAssignment>[] = [
    { key: "vehicle", header: t("columns.vehicle"), cell: (row) => row.vehicle.plate },
    {
      key: "employee",
      header: t("columns.employee"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.employee.name}</span>
          {row.employee.department && <span className="max-w-40 truncate text-small text-fg-muted">{row.employee.department}</span>}
        </span>
      ),
    },
    { key: "startedAt", header: t("columns.start"), cell: (row) => date.format(new Date(row.startedAt)) },
    { key: "endedAt", header: t("columns.end"), cell: (row) => (row.endedAt ? date.format(new Date(row.endedAt)) : "—") },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.endedAt ? "neutral" : "success"}>{row.endedAt ? t("status.closed") : t("status.open")}</StatusChip>,
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
        options={[chip("", filterT("all")), ...ASSIGNMENT_STATE_FILTERS.map((value) => chip(value, t(`filters.${value}`)))]}
      />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/araclar/[plate]", params: { plate: row.vehicle.plate.replace(/ /g, "") } })}
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
