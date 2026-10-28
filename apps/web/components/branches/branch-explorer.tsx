"use client";

import { useCallback, useState } from "react";
import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StateMessage } from "@/components/ui/state-message";
import type { BranchDetail } from "@/lib/branch-detail";
import { cn } from "@/lib/cn";
import { distanceKm } from "@/lib/nearest-branch";
import { BranchCard } from "./branch-card";
import { BranchMap } from "./branch-map";
import {
  KINDS,
  useBranchFilters,
  useIsDesktop,
  useMinuteClock,
  useNearest,
} from "./use-branch-explorer";

type View = "list" | "map";

type BranchExplorerProps = { branches: BranchDetail[]; mapsApiKey: string };

export function BranchExplorer({ branches, mapsApiKey }: BranchExplorerProps) {
  const t = useTranslations("BranchesPage");
  const isDesktop = useIsDesktop();
  const now = useMinuteClock();
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);
  const { position, locate, findNearest, stopNearest } = useNearest(() =>
    setSelectedId(null),
  );
  const {
    query,
    setQuery,
    city,
    setCity,
    kind,
    setKind,
    cityOptions,
    kindCounts,
    matches,
    filtered,
    clear,
  } = useBranchFilters(branches, position);
  const mapAvailable = mapsApiKey !== "" && !mapFailed;
  // Below the desktop width the map and the list take turns; the list is where a visitor
  // starts, and the only view when there is no map.
  const showMap = mapAvailable && (isDesktop || view === "map");
  const showList = !mapAvailable || isDesktop || view === "list";

  function showOnMap(id: string) {
    setSelectedId(id);
    setView("map");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The two fields are centred under the heading, and the list/map switch (below xl) under them. */}
      <div className="flex flex-col items-center gap-4">
        <div className="mx-auto grid w-full gap-4 md:max-w-2xl md:grid-cols-2">
          <Field label={t("cityLabel")}>
            {(control) => (
              <SearchableSelect
                {...control}
                options={cityOptions}
                value={city}
                placeholder={t("allCities")}
                searchLabel={t("citySearch")}
                searchPlaceholder={t("citySearchPlaceholder")}
                emptyText={t("noCity")}
                onChange={(next) => {
                  setCity(next);
                  // A new filter starts from the overview, not from the last branch picked.
                  setSelectedId(null);
                }}
              />
            )}
          </Field>
          <Field label={t("searchLabel")}>
            {(control) => (
              <Input
                {...control}
                type="search"
                value={query}
                placeholder={t("searchPlaceholder")}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                }}
              />
            )}
          </Field>
        </div>
        {/* The kind of branch: all of them, the airport desks, or the city offices. */}
        <div
          role="group"
          aria-label={t("kindLabel")}
          className="flex flex-wrap justify-center gap-2"
        >
          {KINDS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setSelectedId(null);
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
                kind === value
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-strong text-fg hover:bg-selected",
              )}
            >
              {t(`kinds.${value || "all"}`)}
              <span
                aria-hidden="true"
                className={cn(
                  "text-small tabular-nums",
                  kind === value ? "text-on-primary" : "text-fg-muted",
                )}
              >
                {kindCounts[value]}
              </span>
            </button>
          ))}
        </div>

        {/* Nearest first: asks for the position when pressed, uses it here, and keeps it nowhere else. */}
        <div className="flex flex-col items-center gap-2">
          {locate.state === "active" ? (
            <Button type="button" variant="outline" onClick={stopNearest}>
              <LocateFixed aria-hidden="true" className="size-4" />
              {t("near.clear")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={findNearest}
              disabled={locate.state === "locating"}
              aria-busy={locate.state === "locating"}
            >
              <LocateFixed aria-hidden="true" className="size-4" />
              {locate.state === "locating"
                ? t("near.locating")
                : t("near.button")}
            </Button>
          )}
          {locate.state !== "idle" && locate.state !== "locating" && (
            <p role="status" className="text-small text-fg-muted">
              {t(`near.${locate.state}`)}
            </p>
          )}
        </div>

        {mapAvailable && !isDesktop && (
          <SegmentedControl
            label={t("viewLabel")}
            options={[
              { value: "list", label: t("views.list") },
              { value: "map", label: t("views.map") },
            ]}
            value={view}
            onChange={setView}
          />
        )}
      </div>

      {!mapAvailable && (
        <p
          role="status"
          className="rounded-control bg-surface-muted p-4 text-body text-fg-muted"
        >
          {t("mapUnavailable")}
        </p>
      )}

      <p role="status" className="text-small text-fg-muted">
        {filtered
          ? t("countFiltered", {
              count: matches.length,
              total: branches.length,
            })
          : t("count", { count: matches.length })}
      </p>

      {matches.length === 0 ? (
        <StateMessage title={t("noResults.title")} text={t("noResults.text")}>
          <Button type="button" variant="outline" onClick={clear}>
            {t("noResults.clear")}
          </Button>
        </StateMessage>
      ) : (
        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
          {showList && (
            <ul className="grid gap-4 md:grid-cols-2 xl:max-h-160 xl:grid-cols-1 xl:overflow-y-auto">
              {matches.map((branch) => (
                <li key={branch.id}>
                  <BranchCard
                    branch={branch}
                    selected={branch.id === selectedId}
                    onShowOnMap={() => showOnMap(branch.id)}
                    now={now}
                    distanceKm={
                      position
                        ? Math.round(distanceKm(position, branch))
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {showMap && (
            <div className="h-112 overflow-hidden rounded-media border border-border xl:sticky xl:top-24 xl:h-160">
              <BranchMap
                apiKey={mapsApiKey}
                branches={matches}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onFail={onMapFail}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
