import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ExpenseForm } from "@/components/admin/expense-form";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { getAdminExpenses } from "@/lib/admin-server";
import { ADMIN_EXPENSE_LIST, EXPENSE_STATUSES, EXPENSE_TYPES, expenseTone, type ExpenseFilter, type FleetExpense, type FleetExpensePage } from "@/lib/expenses";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.fleetExpenses");
  return { title: t("title") };
}

export default async function FleetExpensesPage({ searchParams }: PageProps<"/[locale]/yonetim/filo-masraflari">) {
  const t = await getTranslations("Admin.fleetExpenses");
  const filterT = await getTranslations("Admin.filter");
  const locale = await getLocale();
  const params = parseAdminListParams(await searchParams, ADMIN_EXPENSE_LIST);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let data: FleetExpensePage | null;
  try {
    data = await getAdminExpenses(params);
  } catch {
    data = null;
  }

  const address = (patch: Patch<ExpenseFilter>) => ({ pathname: "/yonetim/filo-masraflari" as const, query: hrefQuery(params, patch, ADMIN_EXPENSE_LIST) });
  // The moment is written in Istanbul time, the way the whole fleet keeps its days.
  const moment = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const columns: Column<FleetExpense>[] = [
    { key: "occurredAt", header: t("columns.occurredAt"), sortable: true, cell: (row) => moment.format(new Date(row.occurredAt)) },
    { key: "plate", header: t("columns.plate"), cell: (row) => row.vehicle.plate },
    { key: "company", header: t("columns.company"), cell: (row) => <span className="block max-w-56 truncate">{row.company.name}</span> },
    { key: "type", header: t("columns.type"), cell: (row) => t(`type.${row.type}`) },
    { key: "amount", header: t("columns.amount"), sortable: true, align: "right", cell: (row) => money.format(row.amount / 100) },
    { key: "employee", header: t("columns.employee"), cell: (row) => row.employee?.name ?? t("unassigned") },
    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={expenseTone(row.status)}>{t(`status.${row.status}`)}</StatusChip> },
  ];

  const chip = (name: "tur" | "durum", value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Boolean(params.q || params.filters.tur || params.filters.durum);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <ExpenseForm />
      <div className="flex flex-col gap-3">
        <FilterChips label={t("typeFilterLabel")} current={params.filters.tur ?? ""} options={[chip("tur", "", filterT("all")), ...EXPENSE_TYPES.map((type) => chip("tur", type, t(`type.${type}`)))]} />
        <FilterChips label={t("statusFilterLabel")} current={params.filters.durum ?? ""} options={[chip("durum", "", filterT("all")), ...EXPENSE_STATUSES.map((status) => chip("durum", status, t(`status.${status}`)))]} />
        <SearchBox pathname="/yonetim/filo-masraflari" query={hrefQuery(params, {}, ADMIN_EXPENSE_LIST)} value={params.q} label={t("searchLabel")} />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
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
      <p className="text-small text-fg-muted">{t("currencyNote")}</p>
      {data && <Pagination page={params.page} pageSize={params.pageSize} total={data.total} hrefFor={(page) => address({ page })} />}
    </>
  );
}
