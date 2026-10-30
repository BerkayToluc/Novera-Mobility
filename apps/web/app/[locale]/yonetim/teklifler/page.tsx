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
import { QUOTE_LIST, QUOTE_SOURCES, QUOTE_STATUSES, type AdminQuote, type AdminQuotePage } from "@/lib/admin-quotes";
import { getAdminQuotes } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.quotes");
  return { title: t("title") };
}

export default async function QuotesPage({ searchParams }: PageProps<"/[locale]/yonetim/teklifler">) {
  const t = await getTranslations("Admin.quotes");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, QUOTE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminQuotePage | null;
  try {
    data = await getAdminQuotes(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<"durum" | "kaynak">) => ({ pathname: "/yonetim/teklifler" as const, query: hrefQuery(params, patch, QUOTE_LIST) });
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Istanbul" });
  const columns: Column<AdminQuote>[] = [
    { key: "number", header: t("columns.number"), sortable: true, cell: (row) => row.number },
    {
      key: "company",
      header: t("columns.company"),
      cell: (row) => (
        <>
          {row.companyName}
          <span className="block text-small text-fg-muted">{row.anonymized ? t("erased") : (row.contactName ?? "")}</span>
        </>
      ),
    },
    { key: "vehicleCount", header: t("columns.fleet"), sortable: true, align: "right", // May wrap to two lines ("12 vehicles," over "18 months"), so the table fits beside the menu at 1280 px.
      cell: (row) => <span className="inline-block max-w-24 whitespace-normal">{t("fleet", { vehicles: row.vehicleCount, months: row.durationMonths })}</span>,
    },
    { key: "source", header: t("columns.source"), cell: (row) => <span className="inline-block max-w-24 whitespace-normal">{t(`source.${row.source}`)}</span> },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "RECEIVED" ? "warning" : row.status === "CLOSED" ? "neutral" : "success"}>{t(`state.${row.status}`)}</StatusChip>,
    },
    { key: "createdAt", header: t("columns.created"), sortable: true, cell: (row) => day.format(new Date(row.createdAt)) },
  ];

  const chip = (name: "durum" | "kaynak", value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum || params.filters.kaynak);
  const baseQuery = hrefQuery(params, {}, QUOTE_LIST);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("durum", "", filterT("all")), ...QUOTE_STATUSES.map((status) => chip("durum", status, t(`state.${status}`)))]}
        />
        <FilterChips
          label={t("sourceFilterLabel")}
          current={params.filters.kaynak ?? ""}
          options={[chip("kaynak", "", filterT("all")), ...QUOTE_SOURCES.map((source) => chip("kaynak", source, t(`source.${source}`)))]}
        />
        <SearchBox pathname="/yonetim/teklifler" query={baseQuery} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.number}
        rowHref={(row) => ({ pathname: "/yonetim/teklifler/[number]", params: { number: row.number } })}
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
