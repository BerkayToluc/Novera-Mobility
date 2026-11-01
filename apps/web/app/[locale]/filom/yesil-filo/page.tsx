import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FilterChips } from "@/components/admin/filter-chips";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { LineChart } from "@/components/fleet/line-chart";
import { MonthRangeFilter } from "@/components/fleet/month-range-filter";
import { ReportTable } from "@/components/fleet/report-table";
import { SimulationBadge } from "@/components/fleet/simulation-badge";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { fleetNow, getFleetGreen, getFleetStations } from "@/lib/fleet-server";
import { kilograms, pickVehicle, STATIONS_SHOWN, stationTone, type GreenReport, type StationList } from "@/lib/green";
import { monthLabel, PERIOD_CHOICES, parseReportRange } from "@/lib/reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.green");
  return { title: t("title") };
}

export default async function GreenFleetPage({ searchParams }: PageProps<"/[locale]/filom/yesil-filo">) {
  const t = await getTranslations("FleetPanel.green");
  const periodT = await getTranslations("FleetPanel.reports");
  const locale = await getLocale();
  const raw = await searchParams;
  const one = (name: string) => (Array.isArray(raw[name]) ? raw[name][0] : raw[name]);
  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(new Date(await fleetNow())).slice(0, 7);
  const range = parseReportRange({ donem: one("donem"), bas: one("bas"), bit: one("bit") }, thisMonth);

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI.
  let report: GreenReport | null;
  try {
    report = await getFleetGreen(range.from, range.to);
  } catch {
    report = null;
  }
  const chosen = report ? pickVehicle(report.vehicles, one("arac")) : null;
  let stations: StationList | null = null;
  let stationsFailed = false;
  if (chosen) {
    try {
      stations = await getFleetStations(chosen.plate, STATIONS_SHOWN);
    } catch {
      stationsFailed = true;
    }
  }

  // The amounts and distances are written in the visitor's number style.
  const number = new Intl.NumberFormat(locale);
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Istanbul" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const percent = (value: number) => t("percent", { value });
  const scroll = (caption: string) => t("scrollable", { table: caption });
  const address = (extra: Record<string, string> = {}) => ({ pathname: "/filom/yesil-filo" as const, query: { ...(range.choice === "son-3-ay" ? {} : { donem: range.choice }), ...(range.choice === "ozel" ? { bas: range.from, bit: range.to } : {}), ...extra } });

  const chips = PERIOD_CHOICES.map((choice) => ({
    value: choice,
    label: periodT(`periods.${choice}`),
    href: choice === "ozel" ? { pathname: "/filom/yesil-filo" as const, query: { donem: "ozel", bas: range.from, bit: range.to } } : { pathname: "/filom/yesil-filo" as const, query: choice === "son-3-ay" ? {} : { donem: choice } },
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />

      {!report ? (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild variant="outline">
            <Link href={address()}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : report.vehicles.length === 0 ? (
        <StateMessage title={t("emptyTitle")} text={t("emptyText")}>
          <Button asChild variant="outline">
            <Link href="/filom/araclar">{t("emptyAction")}</Link>
          </Button>
        </StateMessage>
      ) : (
        <>
          <section aria-labelledby="green-carbon" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="green-carbon" className="text-h2 text-fg">
                {t("carbon.title")}
              </h2>
              <StatusChip tone="neutral">{t("carbon.example")}</StatusChip>
            </div>
            <div className="flex flex-col gap-3">
              <FilterChips label={periodT("periodLabel")} current={range.choice} options={chips} />
              {range.choice === "ozel" && <MonthRangeFilter pathname="/filom/yesil-filo" from={range.from} to={range.to} max={thisMonth} fromLabel={periodT("from")} toLabel={periodT("to")} applyLabel={periodT("apply")} />}
              <p className="text-small text-fg-muted">{range.from === range.to ? periodT("showing", { period: monthLabel(range.from, locale) }) : periodT("showingRange", { from: monthLabel(range.from, locale), to: monthLabel(range.to, locale) })}</p>
            </div>
            <dl className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
                <dt className="text-label text-fg-muted">{t("carbon.saved")}</dt>
                <dd className="text-h2 text-fg">{t("carbon.kg", { value: kilograms(report.totals.savedGrams, locale) })}</dd>
              </div>
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
                <dt className="text-label text-fg-muted">{t("carbon.km")}</dt>
                <dd className="text-h2 text-fg">{t("km", { value: number.format(report.totals.km) })}</dd>
              </div>
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
                <dt className="text-label text-fg-muted">{t("carbon.cars")}</dt>
                <dd className="text-h2 text-fg">{report.vehicles.length}</dd>
              </div>
            </dl>
            <p className="text-small text-fg-muted">{t("carbon.how", { petrol: report.coefficients.petrol, hybrid: report.coefficients.hybrid, electric: report.coefficients.electric })}</p>
            <ReportTable
              caption={t("carbon.title")}
              scrollLabel={scroll(t("carbon.title"))}
              rows={report.vehicles}
              rowKey={(row) => row.id}
              columns={[
                { key: "plate", header: t("columns.vehicle"), cell: (row) => `${row.plate} · ${row.model}` },
                { key: "fuel", header: t("columns.fuel"), cell: (row) => t(`fuel.${row.fuel}`) },
                { key: "km", header: t("columns.km"), align: "right", cell: (row) => t("km", { value: number.format(row.km) }) },
                { key: "saved", header: t("columns.saved"), align: "right", cell: (row) => t("carbon.kg", { value: kilograms(row.savedGrams, locale) }) },
              ]}
              footer={[t("columns.sum"), "", t("km", { value: number.format(report.totals.km) }), t("carbon.kg", { value: kilograms(report.totals.savedGrams, locale) })]}
            />
          </section>

          <section aria-labelledby="green-charge" className="flex flex-col gap-4">
            <h2 id="green-charge" className="text-h2 text-fg">
              {t("charge.title")}
            </h2>
            <p className="text-body text-fg-muted">{t("charge.text")}</p>
            <ReportTable
              caption={t("charge.title")}
              scrollLabel={scroll(t("charge.title"))}
              rows={report.vehicles}
              rowKey={(row) => row.id}
              columns={[
                { key: "plate", header: t("columns.vehicle"), cell: (row) => `${row.plate} · ${row.model}` },
                {
                  key: "charge",
                  header: t("columns.charge"),
                  align: "right",
                  cell: (row) =>
                    row.charge ? (
                      <span className="inline-flex items-center justify-end gap-3">
                        <svg aria-hidden="true" viewBox="0 0 100 6" preserveAspectRatio="none" className="h-3 w-20 rounded-control bg-surface-muted">
                          <rect x={0} y={0} width={row.charge.percent} height={6} className="fill-primary" />
                        </svg>
                        <span>{`${percent(row.charge.percent)} · ${day.format(new Date(row.charge.at))}`}</span>
                      </span>
                    ) : (
                      t("charge.none")
                    ),
                },
              ]}
            />
          </section>

          <section aria-labelledby="green-battery" className="flex flex-col gap-4">
            <h2 id="green-battery" className="text-h2 text-fg">
              {t("battery.title")}
            </h2>
            <LineChart
              title={t("battery.chart")}
              lines={report.vehicles.filter((vehicle) => vehicle.batteryTrend.length > 0).map((vehicle) => ({ key: vehicle.id, label: vehicle.plate, points: vehicle.batteryTrend }))}
              percent={percent}
              date={(at) => day.format(new Date(at))}
              lastValue={(line) => percent(line.points.at(-1)!.percent)}
              note={report.vehicles.filter((vehicle) => vehicle.batteryTrend.length > 0).length > 4 ? t("battery.firstFour") : t("tableBelow")}
            >
              <ReportTable
                caption={t("battery.chart")}
                scrollLabel={scroll(t("battery.chart"))}
                rows={report.vehicles.flatMap((vehicle) => vehicle.batteryTrend.map((point) => ({ key: `${vehicle.id}|${point.at}`, plate: vehicle.plate, at: point.at, percent: point.percent })))}
                rowKey={(row) => row.key}
                columns={[
                  { key: "plate", header: t("columns.vehicle"), cell: (row) => row.plate },
                  { key: "at", header: t("columns.date"), cell: (row) => day.format(new Date(row.at)) },
                  { key: "percent", header: t("columns.health"), align: "right", cell: (row) => percent(row.percent) },
                ]}
              />
            </LineChart>
          </section>

          <section aria-labelledby="green-stations" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="green-stations" className="text-h2 text-fg">
                {t("stations.title")}
              </h2>
              <SimulationBadge />
            </div>
            <FilterChips
              label={t("stations.vehicleLabel")}
              current={chosen?.plate ?? ""}
              options={report.vehicles.map((vehicle) => ({ value: vehicle.plate, label: vehicle.plate, href: address({ arac: vehicle.plate.replace(/ /g, "") }) }))}
            />
            {stationsFailed ? (
              <StateMessage tone="error" title={t("stations.errorTitle")} text={t("stations.errorText")}>
                <Button asChild variant="outline">
                  <Link href={address({ arac: chosen!.plate.replace(/ /g, "") })}>{t("retry")}</Link>
                </Button>
              </StateMessage>
            ) : !stations || stations.items.length === 0 ? (
              <StateMessage title={t("stations.emptyTitle")} text={t("stations.emptyText")} />
            ) : (
              <>
                <p className="text-small text-fg-muted">
                  {stations.vehicle.position ? t("stations.fromCity", { plate: stations.vehicle.plate, city: stations.vehicle.city }) : t("stations.noPosition", { plate: stations.vehicle.plate, city: stations.vehicle.city })}
                  {" "}
                  {t("stations.updated", { time: time.format(new Date(stations.updatedAt)) })}
                </p>
                <ReportTable
                  caption={t("stations.title")}
                  scrollLabel={scroll(t("stations.title"))}
                  rows={stations.items}
                  rowKey={(row) => row.id}
                  columns={[
                    { key: "name", header: t("columns.station"), cell: (row) => `${row.name} · ${row.city}` },
                    { key: "distance", header: t("columns.distance"), align: "right", cell: (row) => (row.distanceKm === null ? "—" : t("distance", { value: number.format(row.distanceKm) })) },
                    { key: "sockets", header: t("columns.sockets"), cell: (row) => row.sockets.join(", ") },
                    { key: "status", header: t("columns.status"), cell: (row) => <StatusChip tone={stationTone(row.status)}>{t(`stationStatus.${row.status}`)}</StatusChip> },
                  ]}
                />
                <p className="text-small text-fg-muted">{t("stations.note")}</p>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
