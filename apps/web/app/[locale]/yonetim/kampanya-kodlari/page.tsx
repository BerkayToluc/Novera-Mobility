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
import { lastDay, PROMO_LIST, PROMO_STATUSES, PROMO_TONES, type PromoCode, type PromoCodePage } from "@/lib/admin-promo";
import { getPromoCodes } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.promoCodes");
  return { title: t("title") };
}

export default async function PromoCodesPage({ searchParams }: PageProps<"/[locale]/yonetim/kampanya-kodlari">) {
  const t = await getTranslations("Admin.promoCodes");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, PROMO_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: PromoCodePage | null;
  try {
    data = await getPromoCodes(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<"durum">) => ({ pathname: "/yonetim/kampanya-kodlari" as const, query: hrefQuery(params, patch, PROMO_LIST) });
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(iso));
  // The days a code works, written as days: the first, and the last one (the end instant is the start of the day after it).
  const period = (row: PromoCode): string => {
    if (row.validFrom && row.validUntil) return t("period.range", { from: day(row.validFrom), until: day(lastDay(row.validUntil)) });
    if (row.validFrom) return t("period.from", { from: day(row.validFrom) });
    if (row.validUntil) return t("period.until", { until: day(lastDay(row.validUntil)) });
    return t("period.always");
  };

  const columns: Column<PromoCode>[] = [
    { key: "code", header: t("columns.code"), sortable: true, cell: (row) => row.code },
    { key: "percent", header: t("columns.percent"), sortable: true, align: "right", cell: (row) => "%" + row.percent },
    { key: "validUntil", header: t("columns.period"), sortable: true, cell: period },
    {
      key: "used",
      header: t("columns.used"),
      sortable: true,
      align: "right",
      cell: (row) => (row.maxRedemptions === null ? String(row.used) : t("usage", { used: row.used, max: row.maxRedemptions })),
    },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={PROMO_TONES[row.status]}>{t(`status.${row.status}`)}</StatusChip> },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum);
  const newButton = (
    <Button asChild>
      <Link href="/yonetim/kampanya-kodlari/yeni">{t("newButton")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("filterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...PROMO_STATUSES.map((status) => chip(status, t(`status.${status}`)))]}
        />
        <SearchBox pathname="/yonetim/kampanya-kodlari" query={hrefQuery(params, {}, PROMO_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.code}
        rowHref={(row) => ({ pathname: "/yonetim/kampanya-kodlari/[code]", params: { code: row.code } })}
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
