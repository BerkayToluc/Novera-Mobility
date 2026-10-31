import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { BarChart, type ChartSeries } from "@/components/fleet/bar-chart";
import { MonthRangeFilter } from "@/components/fleet/month-range-filter";
import { ReportTable } from "@/components/fleet/report-table";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { currentTime } from "@/lib/clock";
import { getFleetReport } from "@/lib/fleet-server";
import { monthLabel, PERIOD_CHOICES, parseReportRange, type FleetReport } from "@/lib/reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.reports");
  return { title: t("title") };
}

// The most bars one chart draws: the table under it has every row.
const TOP = 10;

export default async function FleetReportsPage({ searchParams }: PageProps<"/[locale]/filom/raporlar">) {
  const t = await getTranslations("FleetPanel.reports");
  const locale = await getLocale();
  const raw = await searchParams;
  const one = (name: string) => (Array.isArray(raw[name]) ? raw[name][0] : raw[name]);
  // The month of today in Istanbul, so "this month" is the same for everyone whatever their clock says.
  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(new Date(currentTime())).slice(0, 7);
  const range = parseReportRange({ donem: one("donem"), bas: one("bas"), bit: one("bit") }, thisMonth);

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI.
  let report: FleetReport | null;
  try {
    report = await getFleetReport(range.from, range.to);
  } catch {
    report = null;
  }

  // The amounts are TRY whatever currency the account chose (FLEET.md §3.1), written in the visitor's number style.
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" });
  const lira = (kurus: number) => money.format(kurus / 100);
  const km = new Intl.NumberFormat(locale);
  const kmText = (value: number) => t("kmUnit", { value: km.format(value) });
  const scroll = (caption: string) => t("scrollable", { table: caption });

  const chips = PERIOD_CHOICES.map((choice) => ({
    value: choice,
    label: t(`periods.${choice}`),
    href: choice === "ozel" ? { pathname: "/filom/raporlar" as const, query: { donem: "ozel", bas: range.from, bit: range.to } } : { pathname: "/filom/raporlar" as const, query: choice === "son-3-ay" ? {} : { donem: choice } },
  }));

  const cost: ChartSeries[] = [
    { label: t("series.invoice"), fill: "fill-primary", swatch: "bg-primary" },
    { label: t("series.expenses"), fill: "fill-accent", swatch: "bg-accent" },
  ];
  const distance: ChartSeries[] = [{ label: t("series.km"), fill: "fill-primary", swatch: "bg-primary" }];
  const noDepartment = t("noDepartment");

  const empty = report !== null && report.totals.total === 0 && report.totals.km === 0;

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="flex flex-col gap-3">
        <FilterChips label={t("periodLabel")} current={range.choice} options={chips} />
        {range.choice === "ozel" && <MonthRangeFilter from={range.from} to={range.to} max={thisMonth} fromLabel={t("from")} toLabel={t("to")} applyLabel={t("apply")} />}
        <p className="text-small text-fg-muted">{range.from === range.to ? t("showing", { period: monthLabel(range.from, locale) }) : t("showingRange", { from: monthLabel(range.from, locale), to: monthLabel(range.to, locale) })}</p>
      </div>

      {!report ? (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild variant="outline">
            <Link href={{ pathname: "/filom/raporlar", query: { donem: range.choice, ...(range.choice === "ozel" ? { bas: range.from, bit: range.to } : {}) } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : empty ? (
        <StateMessage title={t("emptyTitle")} text={t("emptyText")}>
          <Button asChild variant="outline">
            <Link href={{ pathname: "/filom/raporlar", query: { donem: "bu-yil" } }}>{t("emptyAction")}</Link>
          </Button>
        </StateMessage>
      ) : (
        <>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["total", lira(report.totals.total)],
                ["invoice", lira(report.totals.invoice)],
                ["expenses", lira(report.totals.expenses)],
                ["km", kmText(report.totals.km)],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
                <dt className="text-label text-fg-muted">{t(`totals.${key}`)}</dt>
                <dd className="text-h2 text-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-small text-fg-muted">{t("basis")}</p>

          <BarChart
            title={t("months.title")}
            series={cost}
            rows={report.months.map((row) => ({ key: row.period, label: monthLabel(row.period, locale, "short"), segments: [row.invoice, row.expenses] }))}
            format={lira}
            note={t("tableBelow")}
          >
            <ReportTable
              caption={t("months.title")}
              scrollLabel={scroll(t("months.title"))}
              rows={report.months}
              rowKey={(row) => row.period}
              columns={[
                { key: "period", header: t("columns.month"), cell: (row) => monthLabel(row.period, locale) },
                { key: "invoice", header: t("columns.invoice"), align: "right", cell: (row) => lira(row.invoice) },
                { key: "expenses", header: t("columns.expenses"), align: "right", cell: (row) => lira(row.expenses) },
                { key: "total", header: t("columns.total"), align: "right", cell: (row) => lira(row.total) },
              ]}
              footer={[t("columns.sum"), lira(report.totals.invoice), lira(report.totals.expenses), lira(report.totals.total)]}
            />
          </BarChart>

          <BarChart
            title={t("km.title")}
            series={distance}
            rows={report.months.map((row) => ({ key: row.period, label: monthLabel(row.period, locale, "short"), segments: [row.km] }))}
            format={kmText}
            note={t("tableBelow")}
          >
            <ReportTable
              caption={t("km.title")}
              scrollLabel={scroll(t("km.title"))}
              rows={report.months}
              rowKey={(row) => row.period}
              columns={[
                { key: "period", header: t("columns.month"), cell: (row) => monthLabel(row.period, locale) },
                { key: "km", header: t("columns.km"), align: "right", cell: (row) => kmText(row.km) },
              ]}
              footer={[t("columns.sum"), kmText(report.totals.km)]}
            />
          </BarChart>

          <BarChart
            title={t("vehicles.title")}
            series={cost}
            rows={report.vehicles.slice(0, TOP).map((row) => ({ key: row.id, label: row.plate, segments: [row.invoice, row.expenses] }))}
            format={lira}
            note={report.vehicles.length > TOP ? t("topNote", { count: TOP }) : t("tableBelow")}
          >
            <ReportTable
              caption={t("vehicles.title")}
              scrollLabel={scroll(t("vehicles.title"))}
              rows={report.vehicles}
              rowKey={(row) => row.id}
              columns={[
                { key: "plate", header: t("columns.vehicle"), cell: (row) => `${row.plate} · ${row.model}` },
                { key: "invoice", header: t("columns.invoice"), align: "right", cell: (row) => lira(row.invoice) },
                { key: "expenses", header: t("columns.expenses"), align: "right", cell: (row) => lira(row.expenses) },
                { key: "total", header: t("columns.total"), align: "right", cell: (row) => lira(row.total) },
                { key: "km", header: t("columns.km"), align: "right", cell: (row) => kmText(row.km) },
              ]}
              footer={report.unallocated.invoice > 0 ? [t("unallocated"), lira(report.unallocated.invoice), "", lira(report.unallocated.invoice), ""] : undefined}
            />
          </BarChart>

          <BarChart
            title={t("departments.title")}
            series={cost}
            rows={report.departments.slice(0, TOP).map((row) => ({ key: row.department ?? "-", label: row.department ?? noDepartment, segments: [row.invoice, row.expenses] }))}
            format={lira}
            note={report.departments.length > TOP ? t("topNote", { count: TOP }) : t("tableBelow")}
          >
            <ReportTable
              caption={t("departments.title")}
              scrollLabel={scroll(t("departments.title"))}
              rows={report.departments}
              rowKey={(row) => row.department ?? "-"}
              columns={[
                { key: "department", header: t("columns.department"), cell: (row) => row.department ?? noDepartment },
                { key: "invoice", header: t("columns.invoice"), align: "right", cell: (row) => lira(row.invoice) },
                { key: "expenses", header: t("columns.expenses"), align: "right", cell: (row) => lira(row.expenses) },
                { key: "total", header: t("columns.total"), align: "right", cell: (row) => lira(row.total) },
                { key: "km", header: t("columns.km"), align: "right", cell: (row) => kmText(row.km) },
              ]}
              footer={[t("columns.sum"), lira(report.totals.invoice), lira(report.totals.expenses), lira(report.totals.total), kmText(report.totals.km)]}
            />
          </BarChart>
        </>
      )}
    </>
  );
}
