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
import { USER_LIST, USER_STATUSES, USER_TYPES, type AdminUser, type AdminUserPage, type UserFilter } from "@/lib/admin-users";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminUsers } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.users");
  return { title: t("title") };
}

export default async function UsersPage({ searchParams }: PageProps<"/[locale]/yonetim/kullanicilar">) {
  const t = await getTranslations("Admin.users");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, USER_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminUserPage | null;
  try {
    data = await getAdminUsers(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<UserFilter>) => ({ pathname: "/yonetim/kullanicilar" as const, query: hrefQuery(params, patch, USER_LIST) });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Istanbul" });
  const columns: Column<AdminUser>[] = [
    {
      key: "lastName",
      header: t("columns.name"),
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{`${row.firstName} ${row.lastName}`}</span>
          {row.companyName && <span className="max-w-48 truncate text-small text-fg-muted">{row.companyName}</span>}
        </span>
      ),
    },
    { key: "email", header: t("columns.email"), sortable: true, cell: (row) => <span className="block max-w-56 truncate">{row.email}</span> },
    { key: "type", header: t("columns.type"), cell: (row) => t(`type.${row.type}`) },
    { key: "createdAt", header: t("columns.created"), sortable: true, cell: (row) => date.format(new Date(row.createdAt)) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip tone={row.status === "ACTIVE" ? "success" : "error"}>{t(`status.${row.status}`)}</StatusChip>,
    },
  ];

  const chip = (name: UserFilter, value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Boolean(params.q || params.filters.tur || params.filters.durum);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("typeFilterLabel")}
          current={params.filters.tur ?? ""}
          options={[chip("tur", "", filterT("all")), ...USER_TYPES.map((type) => chip("tur", type, t(`type.${type}`)))]}
        />
        <FilterChips
          label={t("statusFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("durum", "", filterT("all")), ...USER_STATUSES.map((status) => chip("durum", status, t(`status.${status}`)))]}
        />
        <SearchBox pathname="/yonetim/kullanicilar" query={hrefQuery(params, {}, USER_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/kullanicilar/[id]", params: { id: row.id } })}
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
