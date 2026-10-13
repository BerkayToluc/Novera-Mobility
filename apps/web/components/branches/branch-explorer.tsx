"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StateMessage } from "@/components/ui/state-message";
import { inCity, matchesBranch, type BranchDetail } from "@/lib/branch-detail";
import { BranchCard } from "./branch-card";
import { BranchMap } from "./branch-map";

type View = "list" | "map";

// Same width as the header's inline menu: from here the list and the map sit side by side.
const DESKTOP_QUERY = "(min-width: 80rem)";

function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

type BranchExplorerProps = { branches: BranchDetail[]; mapsApiKey: string };

export function BranchExplorer({ branches, mapsApiKey }: BranchExplorerProps) {
  const t = useTranslations("BranchesPage");
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);

  // Cities in the order the branches come, each once, with how many branches each has; "all cities" first.
  const cityOptions = useMemo<SearchableOption[]>(() => {
    const counts = new Map<string, number>();
    for (const branch of branches) counts.set(branch.city, (counts.get(branch.city) ?? 0) + 1);
    return [
      { value: "", label: t("allCities"), hint: t("count", { count: branches.length }) },
      ...[...counts].map(([name, count]) => ({ value: name, label: name, hint: t("count", { count }) })),
    ];
  }, [branches, t]);
  const matches = useMemo(
    () => branches.filter((branch) => inCity(branch, city) && matchesBranch(branch, query)),
    [branches, city, query],
  );
  const filtered = city !== "" || query !== "";
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
        <p role="status" className="rounded-control bg-surface-muted p-4 text-body text-fg-muted">
          {t("mapUnavailable")}
        </p>
      )}

      <p role="status" className="text-small text-fg-muted">
        {filtered ? t("countFiltered", { count: matches.length, total: branches.length }) : t("count", { count: matches.length })}
      </p>

      {matches.length === 0 ? (
        <StateMessage title={t("noResults.title")} text={t("noResults.text")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQuery("");
              setCity("");
            }}
          >
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
