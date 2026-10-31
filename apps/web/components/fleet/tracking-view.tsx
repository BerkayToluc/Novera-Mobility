"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FilterChips } from "@/components/admin/filter-chips";
import { StatusChip } from "@/components/admin/status-chip";
import { ReportTable } from "@/components/fleet/report-table";
import { SimulationBadge } from "@/components/fleet/simulation-badge";
import { Link, useRouter } from "@/i18n/navigation";
import { onMap, REFRESH_MS, ignitionTone, pinNumber, routeDays, type RouteDay, type TrackingList } from "@/lib/tracking";
import { refreshTracking } from "@/lib/tracking-actions";

// The map's code is fetched only when this screen asks for it, and only if there is a key (ADR-09: no other page pays for it).
const TrackingMap = dynamic(() => import("./tracking-map"), { ssr: false });

type Props = {
  initial: TrackingList;
  initialRoute: RouteDay | null;
  // The plate in the address (`arac`), and the day of the route (`gun`, today when none).
  plate: string | null;
  day: string;
  today: string;
  mapsApiKey: string;
};

// The live tracking screen (V2-43, docs/FLEET.md §3): the list of the cars, the map beside it, and the route of the one that is chosen. It
// asks for the answer again every thirty seconds, and not while the tab is hidden. The list says everything the map says (the map is not the
// only source), so with no key, a key Google rejects, or a car with no place, the screen works as a list.
export function TrackingView({ initial, initialRoute, plate, day, today, mapsApiKey }: Props) {
  const t = useTranslations("FleetPanel.tracking");
  const locale = useLocale();
  const router = useRouter();
  const [tracking, setTracking] = useState(initial);
  const [route, setRoute] = useState(initialRoute);
  const [failed, setFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);

  const refresh = useCallback(async () => {
    const result = await refreshTracking(plate, day);
    if (result.status === "ok") {
      setTracking(result.tracking);
      setRoute(result.route);
      setFailed(false);
    } else {
      // The last answer stays on the screen; it is only said that it could not be renewed.
      setFailed(true);
    }
  }, [plate, day]);

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      last = Date.now();
      void refresh();
    };
    const interval = setInterval(tick, REFRESH_MS);
    // Back to a tab that was hidden: renew at once if the answer is older than the interval, instead of waiting out the rest of it.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= REFRESH_MS) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const compact = (value: string) => value.replace(/\s+/g, "");
  const selected = plate ? (tracking.items.find((item) => compact(item.plate) === compact(plate)) ?? null) : null;
  const pins = onMap(tracking.items).map((vehicle) => ({ number: pinNumber(tracking.items, vehicle.plate), vehicle }));
  const mapOffered = mapsApiKey !== "" && !mapFailed && pins.length > 0;

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const speed = (value: number) => t("speed", { value });
  const address = (extra: Record<string, string>) => ({ pathname: "/filom/canli-takip" as const, query: extra });
  const choose = (next: string) => router.push(address({ arac: compact(next) }));

  // The route by the hour, as a table: what the line says, for a person who does not see the map.
  const hourly = route ? route.points.filter((point) => new Date(point.at).getUTCMinutes() === 0) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <SimulationBadge />
        <p className="text-small text-fg-muted">{t("updated", { time: time.format(new Date(tracking.updatedAt)) })}</p>
        <p className="text-small text-fg-muted">{t("refreshNote")}</p>
      </div>
      {failed && (
        <p role="status" className="text-small text-error">
          {t("refreshFailed")}
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="tracking-list" className="flex min-w-0 flex-col gap-4">
          <h2 id="tracking-list" className="text-h2 text-fg">
            {t("list.title")}
          </h2>
          <ReportTable
            caption={t("list.title")}
            scrollLabel={t("scrollable", { table: t("list.title") })}
            rows={tracking.items}
            rowKey={(row) => row.plate}
            columns={[
              { key: "pin", header: t("columns.pin"), cell: (row) => pinNumber(tracking.items, row.plate) },
              {
                key: "vehicle",
                header: t("columns.vehicle"),
                cell: (row) => (
                  <Link href={address({ arac: compact(row.plate) })} aria-current={selected?.plate === row.plate ? "true" : undefined} className="inline-flex min-h-11 items-center text-fg underline underline-offset-4">
                    {`${row.plate} · ${row.model}`}
                  </Link>
                ),
              },
              { key: "person", header: t("columns.person"), cell: (row) => row.employee?.name ?? t("noPerson") },
              { key: "city", header: t("columns.city"), cell: (row) => (row.position ? row.city : t("noPosition", { city: row.city })) },
              { key: "ignition", header: t("columns.ignition"), cell: (row) => <StatusChip tone={ignitionTone(row.ignition)}>{t(row.ignition ? "ignition.on" : "ignition.off")}</StatusChip> },
              { key: "speed", header: t("columns.speed"), align: "right", cell: (row) => speed(row.speedKmh) },
            ]}
          />
          <p className="text-small text-fg-muted">{t("list.hint")}</p>
        </section>

        <section aria-labelledby="tracking-map" className="flex min-w-0 flex-col gap-4">
          <h2 id="tracking-map" className="text-h2 text-fg">
            {t("map.title")}
          </h2>
          {mapOffered ? (
            <div className="h-80 overflow-hidden rounded-card border border-border xl:h-96">
              <TrackingMap apiKey={mapsApiKey} pins={pins} selectedPlate={selected?.plate ?? null} route={route} onSelect={choose} onFail={onMapFail} />
            </div>
          ) : (
            <p className="rounded-card border border-border bg-surface-muted p-5 text-body text-fg-muted">{mapsApiKey === "" ? t("map.noKey") : mapFailed ? t("map.failed") : t("map.noPins")}</p>
          )}
        </section>
      </div>

      {selected && (
        <section aria-labelledby="tracking-route" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="tracking-route" className="text-h2 text-fg">
              {t("route.title", { plate: selected.plate })}
            </h2>
            <SimulationBadge />
          </div>
          <FilterChips
            label={t("route.dayLabel")}
            current={day}
            options={routeDays(today).map((value) => ({ value, label: value === today ? t("route.today") : dayName.format(new Date(`${value}T00:00:00Z`)), href: address({ arac: compact(selected.plate), ...(value === today ? {} : { gun: value }) }) }))}
          />
          {!route || route.points.length === 0 ? (
            <p className="rounded-card border border-border bg-surface-muted p-5 text-body text-fg-muted">{t("route.none", { city: selected.city })}</p>
          ) : (
            <>
              <p className="text-small text-fg-muted">{t("route.summary", { name: route.vehicle.route ?? "", count: route.points.length })}</p>
              <ReportTable
                caption={t("route.title", { plate: selected.plate })}
                scrollLabel={t("scrollable", { table: t("route.title", { plate: selected.plate }) })}
                rows={hourly}
                rowKey={(row) => row.at}
                columns={[
                  { key: "at", header: t("route.columns.time"), cell: (row) => time.format(new Date(row.at)) },
                  { key: "ignition", header: t("columns.ignition"), cell: (row) => <StatusChip tone={ignitionTone(row.ignition)}>{t(row.ignition ? "ignition.on" : "ignition.off")}</StatusChip> },
                  { key: "speed", header: t("columns.speed"), align: "right", cell: (row) => speed(row.speedKmh) },
                  { key: "place", header: t("route.columns.place"), cell: (row) => `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}` },
                ]}
              />
              <p className="text-small text-fg-muted">{t("route.hourlyNote")}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
