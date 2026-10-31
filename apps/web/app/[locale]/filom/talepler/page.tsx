import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SelectFilter } from "@/components/admin/select-filter";
import { StatusChip } from "@/components/admin/status-chip";
import { RequestHelp } from "@/components/fleet/request-help";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getFleetRequests, getFleetSummary } from "@/lib/fleet-server";
import { OPEN_FILTER, REQUEST_LIST, REQUEST_STATUSES, REQUEST_TYPES, requestTone, type RequestFilter, type ServiceRequest, type ServiceRequestPage } from "@/lib/requests";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.requests");
  return { title: t("title") };
}

export default async function FleetRequestsPage({ searchParams }: PageProps<"/[locale]/filom/talepler">) {
  const t = await getTranslations("FleetPanel.requests");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, REQUEST_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: ServiceRequestPage | null;
  try {
    data = await getFleetRequests(params);
  } catch {
    data = null;
  }

  // A transfer is only for companies with a VIP Mobilite contract, so only they get its chip (V2-42). If the summary cannot be had, no chip.
  const vip = await getFleetSummary().then((summary) => summary.hasVipContract).catch(() => false);
  const address = (patch: Patch<RequestFilter>) => ({ pathname: "/filom/talepler" as const, query: hrefQuery(params, patch, REQUEST_LIST) });
  const moment = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const columns: Column<ServiceRequest>[] = [
    { key: "number", header: t("columns.number"), cell: (row) => row.number },
    { key: "type", header: t("columns.type"), cell: (row) => t(`type.${row.type}`) },
    { key: "vehicle", header: t("columns.vehicle"), cell: (row) => (row.vehicle ? `${row.vehicle.plate}` : t("facts.none")) },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={requestTone(row.type, row.status)}>{t(`status.${row.status}`)}</StatusChip> },
    { key: "updatedAt", header: t("columns.updated"), sortable: true, cell: (row) => moment.format(new Date(row.updatedAt)) },
  ];
  const typeChip = (value: string, label: string) => ({ value, label, href: address({ filters: { tur: value || null } }) });
  const filtered = Boolean(params.filters.durum || params.filters.tur);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        action={
          <Button asChild>
            <Link href="/filom/talepler/yeni">{t("newButton")}</Link>
          </Button>
        }
      />
      <RequestHelp />
      <div className="flex flex-col gap-3">
        <FilterChips label={t("typeFilterLabel")} current={params.filters.tur ?? ""} options={[typeChip("", t("filterAll")), ...REQUEST_TYPES.filter((type) => type !== "TRANSFER" || vip).map((type) => typeChip(type, t(`type.${type}`)))]} />
        <SelectFilter
          pathname="/filom/talepler"
          query={hrefQuery(params, {}, REQUEST_LIST)}
          name="durum"
          value={params.filters.durum ?? ""}
          label={t("statusFilterLabel")}
          allLabel={t("filterAll")}
          applyLabel={t("apply")}
          options={[{ value: OPEN_FILTER, label: t("filterOpen") }, ...REQUEST_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))]}
        />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/filom/talepler/[number]", params: { number: row.number } })}
        sort={params.sort}
        sortHref={(key, dir) => address({ sort: { key, dir } })}
        state={data ? "ready" : "error"}
        empty={filtered ? { title: t("emptyFilteredTitle"), text: t("emptyFilteredText") } : { title: t("emptyTitle"), text: t("emptyText"), action: <Button asChild><Link href="/filom/talepler/yeni">{t("newButton")}</Link></Button> }}
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
