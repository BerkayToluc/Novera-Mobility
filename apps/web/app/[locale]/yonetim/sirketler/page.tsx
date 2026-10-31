import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { COMPANY_LIST, type AdminCompany, type AdminCompanyPage } from "@/lib/admin-companies";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminCompanies } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.companies");
  return { title: t("title") };
}

export default async function CompaniesPage({ searchParams }: PageProps<"/[locale]/yonetim/sirketler">) {
  const t = await getTranslations("Admin.companies");
  const params = parseAdminListParams(await searchParams, COMPANY_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminCompanyPage | null;
  try {
    data = await getAdminCompanies(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<never>) => ({ pathname: "/yonetim/sirketler" as const, query: hrefQuery(params, patch, COMPANY_LIST) });
  const columns: Column<AdminCompany>[] = [
    {
      key: "name",
      header: t("columns.name"),
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.name}</span>
          {(row.city || row.taxOffice) && <span className="text-small text-fg-muted">{[row.city, row.taxOffice].filter(Boolean).join(" · ")}</span>}
        </span>
      ),
    },
    { key: "users", header: t("columns.users"), sortable: true, align: "right", cell: (row) => String(row.users) },
    { key: "pending", header: t("columns.pending"), align: "right", cell: (row) => String(row.pendingUsers) },
  ];

  const filtered = Boolean(params.q);
  const newButton = (
    <Button asChild>
      <Link href="/yonetim/sirketler/yeni">{t("newButton")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} action={newButton} />
      <SearchBox pathname="/yonetim/sirketler" query={hrefQuery(params, {}, COMPANY_LIST)} value={params.q} label={t("searchLabel")} />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/sirketler/[id]", params: { id: row.id } })}
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
