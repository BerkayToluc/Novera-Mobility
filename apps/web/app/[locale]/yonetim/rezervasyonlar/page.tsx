import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { SelectFilter } from "@/components/admin/select-filter";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { adminPhase, QUICK_FILTERS, RESERVATION_LIST, RESERVATION_STATUSES, validDay, type AdminReservation, type AdminReservationPage, type ReservationFilter } from "@/lib/admin-reservations";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminReservations, getBranchOptions } from "@/lib/admin-server";
import { currentTime } from "@/lib/clock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.reservations");
  return { title: t("title") };
}

export default async function ReservationsPage({ searchParams }: PageProps<"/[locale]/yonetim/rezervasyonlar">) {
  const t = await getTranslations("Admin.reservations");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, RESERVATION_LIST);
  // A day that is not a real one is shown as empty, the same as the query leaves it out.
  const from = validDay(params.filters.bas) ?? "";
  const to = validDay(params.filters.bit) ?? "";

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI. The branches only fill the filter,
  // so the list still shows when they are missing.
  let data: AdminReservationPage | null;
  try {
    data = await getAdminReservations(params);
  } catch {
    data = null;
  }
  const branches = await getBranchOptions(true).catch(() => []);

  const address = (patch: Patch<ReservationFilter>) => ({ pathname: "/yonetim/rezervasyonlar" as const, query: hrefQuery(params, patch, RESERVATION_LIST) });
  const dateOnly = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Istanbul" });
  const timeOnly = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Europe/Istanbul" });
  const now = currentTime();
  const columns: Column<AdminReservation>[] = [
    { key: "number", header: t("columns.number"), sortable: true, cell: (row) => row.number },
    // The name here (the e-mail is what the search reads, and the booking shows it); the car with its pick-up branch under it, so the
    // table fits beside the menu at 1280 px without its last columns running out of sight.
    { key: "customer", header: t("columns.customer"), cell: (row) => (row.customer ? row.customer.name : t("noCustomer")) },
    {
      key: "vehicle",
      header: t("columns.vehicle"),
      cell: (row) => (
        <>
          <span className="block max-w-36 truncate" title={`${row.vehicle.brand} ${row.vehicle.model}`}>
            {`${row.vehicle.brand} ${row.vehicle.model}`}
          </span>
          <span className="block max-w-36 truncate text-small text-fg-muted" title={row.pickupBranch.name}>
            {row.pickupBranch.name}
          </span>
        </>
      ),
    },
    { key: "startAt", header: t("columns.start"), sortable: true, cell: (row) => (
        <>
          {dateOnly.format(new Date(row.startAt))}
          <span className="block text-small text-fg-muted">{timeOnly.format(new Date(row.startAt))}</span>
        </>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => {
        const phase = adminPhase(row, now);
        return <StatusChip tone={phase === "UPCOMING" || phase === "ACTIVE" ? "success" : "neutral"}>{t(`phase.${phase}`)}</StatusChip>;
      },
    },
    {
      key: "total",
      header: t("columns.total"),
      align: "right",
      cell: (row) => new Intl.NumberFormat(locale, { style: "currency", currency: row.total.currency }).format(row.total.amount / 100),
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const quick = (Object.keys(QUICK_FILTERS) as Array<keyof typeof QUICK_FILTERS>).filter((name) => params.filters[name]);
  const filtered = Boolean(params.q || params.filters.durum || params.filters.bayi || from || to || quick.length > 0);
  const baseQuery = hrefQuery(params, {}, RESERVATION_LIST);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      {/* The summary card this list was opened from: said in words, with a way to take it off. */}
      {quick.map((name) => (
        <p key={name} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-muted p-3 text-body text-fg">
          {t(`quick.${name}`)}
          <Button asChild variant="outline">
            <Link href={address({ filters: { [name]: null } })}>{t("quick.remove")}</Link>
          </Button>
        </p>
      ))}
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...RESERVATION_STATUSES.map((status) => chip(status, t(`status.${status}`)))]}
        />
        <SelectFilter
          pathname="/yonetim/rezervasyonlar"
          query={baseQuery}
          name="bayi"
          value={params.filters.bayi ?? ""}
          label={t("branchFilterLabel")}
          allLabel={t("allBranches")}
          applyLabel={t("apply")}
          options={branches.map((branch) => ({ value: branch.id, label: branch.label }))}
        />
        <DateRangeFilter
          pathname="/yonetim/rezervasyonlar"
          query={baseQuery}
          fromName="bas"
          toName="bit"
          from={from}
          to={to}
          fromLabel={t("fromLabel")}
          toLabel={t("toLabel")}
          applyLabel={t("apply")}
          clearLabel={t("clearDates")}
        />
        <SearchBox pathname="/yonetim/rezervasyonlar" query={baseQuery} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.number}
        rowHref={(row) => ({ pathname: "/yonetim/rezervasyonlar/[number]", params: { number: row.number } })}
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
