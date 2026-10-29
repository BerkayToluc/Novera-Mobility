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
import { MODEL_LIST, MODEL_STATUSES, FUEL_TYPES, type AdminModel, type AdminModelPage } from "@/lib/admin-models";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminModels, getModelClasses } from "@/lib/admin-server";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.models");
  return { title: t("title") };
}

export default async function ModelsPage({ searchParams }: PageProps<"/[locale]/yonetim/modeller">) {
  const t = await getTranslations("Admin.models");
  const filterT = await getTranslations("Admin.filter");
  const locale = (await getLocale()) as "tr" | "en";
  const params = parseAdminListParams(await searchParams, MODEL_LIST);

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI. The classes only fill the filter,
  // so the list still shows when they are missing.
  let data: AdminModelPage | null;
  try {
    data = await getAdminModels(params);
  } catch {
    data = null;
  }
  const classes = await getModelClasses().catch(() => []);

  const address = (patch: Patch<"sinif" | "yakit" | "durum">) => ({ pathname: "/yonetim/modeller" as const, query: hrefQuery(params, patch, MODEL_LIST) });
  const columns: Column<AdminModel>[] = [
    {
      key: "name",
      header: t("columns.name"),
      sortable: true,
      cell: (row) => `${row.brand} ${row.model}`,
    },
    { key: "class", header: t("columns.class"), cell: (row) => row.class.name[locale] },
    { key: "fuel", header: t("columns.fuel"), cell: (row) => t(`fuel.${row.fuelType}`) },
    {
      key: "dailyPrice",
      header: t("columns.dailyPrice"),
      sortable: true,
      align: "right",
      cell: (row) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(row.dailyPrice / 100),
    },
    { key: "activeVehicles", header: t("columns.vehicles"), sortable: true, align: "right", cell: (row) => String(row.activeVehicles) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (name: "durum" | "yakit" | "sinif", value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum || params.filters.yakit || params.filters.sinif);
  const newButton = (
    <Button asChild>
      <Link href="/yonetim/modeller/yeni">{t("newButton")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("durum", "", filterT("all")), ...MODEL_STATUSES.map((status) => chip("durum", status, t(`status.${status}`)))]}
        />
        <FilterChips
          label={t("fuelFilterLabel")}
          current={params.filters.yakit ?? ""}
          options={[chip("yakit", "", filterT("all")), ...FUEL_TYPES.map((fuel) => chip("yakit", fuel, t(`fuel.${fuel}`)))]}
        />
        {classes.length > 0 && (
          <FilterChips
            label={t("classFilterLabel")}
            current={params.filters.sinif ?? ""}
            options={[chip("sinif", "", filterT("all")), ...classes.map((entry) => chip("sinif", entry.slug, entry.name[locale]))]}
          />
        )}
        <SearchBox pathname="/yonetim/modeller" query={hrefQuery(params, {}, MODEL_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.slug}
        rowHref={(row) => ({ pathname: "/yonetim/modeller/[slug]", params: { slug: row.slug } })}
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
