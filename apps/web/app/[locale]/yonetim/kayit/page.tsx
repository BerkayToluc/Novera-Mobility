import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SelectFilter } from "@/components/admin/select-filter";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { AUDIT_ENTITIES, AUDIT_LIST, CLI_ACTOR, validActor, type AdminAuditEntry, type AdminAuditPage, type AuditFilter } from "@/lib/admin-audit";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { validDay } from "@/lib/admin-reservations";
import { getAdminAudit, getAuditActors } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.audit");
  return { title: t("title") };
}

export default async function AuditLogPage({ searchParams }: PageProps<"/[locale]/yonetim/kayit">) {
  const t = await getTranslations("Admin.audit");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, AUDIT_LIST);
  // A day that is not a real one is shown as empty, the same as the query leaves it out.
  const from = validDay(params.filters.bas) ?? "";
  const to = validDay(params.filters.bit) ?? "";
  const actor = validActor(params.filters.yonetici) ?? "";

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI. The administrators only fill the
  // filter, so the log still shows when they are missing.
  let data: AdminAuditPage | null;
  try {
    data = await getAdminAudit(params);
  } catch {
    data = null;
  }
  const actors = await getAuditActors().catch(() => []);

  const address = (patch: Patch<AuditFilter>) => ({ pathname: "/yonetim/kayit" as const, query: hrefQuery(params, patch, AUDIT_LIST) });
  const baseQuery = hrefQuery(params, {}, AUDIT_LIST);
  const dateTime = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  // A name for what the log says where there is one; a kind or action this screen does not know yet is shown as the log wrote it.
  const entityName = (entity: string) => (t.has(`entities.${entity}` as "entities.branch") ? t(`entities.${entity}` as "entities.branch") : entity);
  const actionName = (action: string) => (t.has(`actions.${action}` as "actions.branch.close") ? t(`actions.${action}` as "actions.branch.close") : action);
  const who = (row: AdminAuditEntry) => (row.actor.id === CLI_ACTOR ? t("cli") : (row.actor.name ?? t("deletedAccount")));

  const columns: Column<AdminAuditEntry>[] = [
    { key: "at", header: t("columns.when"), cell: (row) => dateTime.format(new Date(row.at)) },
    { key: "actor", header: t("columns.who"), cell: (row) => <span className="block max-w-40 truncate">{who(row)}</span> },
    {
      key: "action",
      header: t("columns.what"),
      cell: (row) => (
        <>
          {actionName(row.action)}
          <span className="block max-w-56 truncate text-small text-fg-muted">{`${entityName(row.entity)}${row.entityId ? ` · ${row.entityId}` : ""}`}</span>
        </>
      ),
    },
    { key: "fields", header: t("columns.fields"), cell: (row) => <span className="block max-w-56 truncate">{row.fields.length > 0 ? row.fields.join(", ") : "—"}</span> },
  ];

  const filtered = Boolean(actor || params.filters.alan || from || to);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <SelectFilter
          pathname="/yonetim/kayit"
          query={baseQuery}
          name="yonetici"
          value={actor}
          label={t("actorFilterLabel")}
          allLabel={t("allActors")}
          applyLabel={t("apply")}
          options={[...actors.map((entry) => ({ value: entry.id, label: entry.label })), { value: CLI_ACTOR, label: t("cli") }]}
        />
        <SelectFilter
          pathname="/yonetim/kayit"
          query={baseQuery}
          name="alan"
          value={params.filters.alan ?? ""}
          label={t("entityFilterLabel")}
          allLabel={t("allEntities")}
          applyLabel={t("apply")}
          options={AUDIT_ENTITIES.map((entity) => ({ value: entity, label: entityName(entity) }))}
        />
        <DateRangeFilter
          pathname="/yonetim/kayit"
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
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
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
