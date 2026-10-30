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
import { MESSAGE_LIST, MESSAGE_STATES, type AdminMessage, type AdminMessagePage } from "@/lib/admin-messages";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminMessages } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.messages");
  return { title: t("title") };
}

export default async function MessagesPage({ searchParams }: PageProps<"/[locale]/yonetim/mesajlar">) {
  const t = await getTranslations("Admin.messages");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, MESSAGE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: AdminMessagePage | null;
  try {
    data = await getAdminMessages(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<"durum">) => ({ pathname: "/yonetim/mesajlar" as const, query: hrefQuery(params, patch, MESSAGE_LIST) });
  const dateOnly = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "Europe/Istanbul" });
  const timeOnly = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Europe/Istanbul" });
  const columns: Column<AdminMessage>[] = [
    { key: "subject", header: t("columns.subject"), cell: (row) => row.subject },
    // The sender with the first words of the message under the name, so the table fits beside the menu at 1280 px.
    {
      key: "from",
      header: t("columns.from"),
      cell: (row) => (
        <>
          {row.anonymized ? t("erased") : row.name}
          <span className="block max-w-64 truncate text-small text-fg-muted" title={row.anonymized ? undefined : row.preview}>
            {row.anonymized ? "—" : row.preview}
          </span>
        </>
      ),
    },
    {
      key: "createdAt",
      header: t("columns.received"),
      sortable: true,
      cell: (row) => (
        <>
          {dateOnly.format(new Date(row.createdAt))}
          <span className="block text-small text-fg-muted">{timeOnly.format(new Date(row.createdAt))}</span>
        </>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => {
        const state = row.handledAt ? "handled" : row.anonymized ? "erased" : "waiting";
        return <StatusChip tone={state === "waiting" ? "warning" : state === "handled" ? "success" : "neutral"}>{t(`state.${state}`)}</StatusChip>;
      },
    },
  ];

  const chip = (value: string, label: string) => ({ value, label, href: address({ filters: { durum: value || null } }) });
  const filtered = Boolean(params.q || params.filters.durum);
  const baseQuery = hrefQuery(params, {}, MESSAGE_LIST);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("stateFilterLabel")}
          current={params.filters.durum ?? ""}
          options={[chip("", filterT("all")), ...MESSAGE_STATES.map((state) => chip(state, t(`filter.${state}`)))]}
        />
        <SearchBox pathname="/yonetim/mesajlar" query={baseQuery} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ({ pathname: "/yonetim/mesajlar/[id]", params: { id: row.id } })}
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
