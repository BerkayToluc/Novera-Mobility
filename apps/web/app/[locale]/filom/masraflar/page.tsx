import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SelectFilter } from "@/components/admin/select-filter";
import { ExpenseTable } from "@/components/fleet/expense-table";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { hrefQuery, parseAdminListParams, type Patch } from "@/lib/admin-query";
import { cleanFleetExpenseFilters, EXPENSE_STATUSES, EXPENSE_TYPES, FLEET_EXPENSE_LIST, type FleetExpenseFilter, type FleetExpensePage } from "@/lib/expenses";
import { getAssignableEmployees, getFleetExpenses, getFleetVehicles } from "@/lib/fleet-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.expenses");
  return { title: t("title") };
}

export default async function FleetExpensesPage({ searchParams }: PageProps<"/[locale]/filom/masraflar">) {
  const t = await getTranslations("FleetPanel.expenses");
  const filterT = await getTranslations("FleetPanel.filter");
  const parsed = parseAdminListParams(await searchParams, FLEET_EXPENSE_LIST);
  const params = { ...parsed, filters: cleanFleetExpenseFilters(parsed.filters) };

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI. The choices of the car and person filters
  // are a convenience: if they cannot be loaded the list still shows.
  let data: FleetExpensePage | null;
  try {
    data = await getFleetExpenses(params);
  } catch {
    data = null;
  }
  const [people, cars] = await Promise.all([getAssignableEmployees().catch(() => []), getFleetVehicles({ page: 1, pageSize: 100, sort: { key: "plate", dir: "asc" }, q: "", filters: {} }).then((page) => page.items).catch(() => [])]);

  const address = (patch: Patch<FleetExpenseFilter>) => ({ pathname: "/filom/masraflar" as const, query: hrefQuery(params, patch, FLEET_EXPENSE_LIST) });
  const chip = (name: "tur" | "durum", value: string, label: string) => ({ value, label, href: address({ filters: { [name]: value || null } }) });
  const filtered = Object.keys(params.filters).length > 0;
  const query = hrefQuery(params, {}, FLEET_EXPENSE_LIST);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips label={t("typeFilterLabel")} current={params.filters.tur ?? ""} options={[chip("tur", "", filterT("all")), ...EXPENSE_TYPES.map((type) => chip("tur", type, t(`type.${type}`)))]} />
        <FilterChips label={t("statusFilterLabel")} current={params.filters.durum ?? ""} options={[chip("durum", "", filterT("all")), ...EXPENSE_STATUSES.map((status) => chip("durum", status, t(`status.${status}`)))]} />
        <SelectFilter
          pathname="/filom/masraflar"
          query={query}
          name="arac"
          value={params.filters.arac ?? ""}
          label={t("filters.vehicleLabel")}
          allLabel={t("filters.vehicleAll")}
          applyLabel={t("filters.apply")}
          options={cars.map((car) => ({ value: car.id, label: car.plate }))}
        />
        <SelectFilter
          pathname="/filom/masraflar"
          query={query}
          name="personel"
          value={params.filters.personel ?? ""}
          label={t("filters.employeeLabel")}
          allLabel={t("filters.employeeAll")}
          applyLabel={t("filters.apply")}
          options={[{ value: "yok", label: t("unassigned") }, ...people.map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }))]}
        />
        <DateRangeFilter
          pathname="/filom/masraflar"
          query={query}
          fromName="bas"
          toName="bit"
          from={params.filters.bas ?? ""}
          to={params.filters.bit ?? ""}
          fromLabel={t("filters.from")}
          toLabel={t("filters.to")}
          applyLabel={t("filters.apply")}
          clearLabel={t("filters.clear")}
        />
      </div>

      {!data ? (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild variant="outline">
            <Link href={address({})}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : data.items.length === 0 ? (
        <StateMessage title={filtered ? t("emptyFilteredTitle") : t("emptyTitle")} text={filtered ? t("emptyFilteredText") : t("emptyText")} />
      ) : (
        <ExpenseTable
          rows={data.items}
          sort={params.sort}
          sortHrefs={Object.fromEntries(FLEET_EXPENSE_LIST.sortable.map((key) => [key, address({ sort: { key, dir: params.sort?.key === key && params.sort.dir === "asc" ? "desc" : "asc" } })]))}
        />
      )}
      <p className="text-small text-fg-muted">{t("currencyNote")}</p>
      {data && <Pagination page={params.page} pageSize={params.pageSize} total={data.total} hrefFor={(page) => address({ page })} />}
    </>
  );
}
