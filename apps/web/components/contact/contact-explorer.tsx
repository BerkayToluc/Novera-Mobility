"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StateMessage } from "@/components/ui/state-message";
import { matchesBranch, type BranchDetail } from "@/lib/branch-detail";
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

type ContactExplorerProps = { branches: BranchDetail[]; mapsApiKey: string };

export function ContactExplorer({ branches, mapsApiKey }: ContactExplorerProps) {
  const t = useTranslations("ContactPage");
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);

  const matches = useMemo(() => branches.filter((branch) => matchesBranch(branch, query)), [branches, query]);
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full max-w-md flex-col gap-2">
          <label htmlFor="branch-search" className="text-label text-fg">
            {t("searchLabel")}
          </label>
          <Input
            id="branch-search"
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              // A new search starts from the overview, not from the last branch picked.
              setSelectedId(null);
            }}
          />
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
        {t("count", { count: matches.length })}
      </p>

      {matches.length === 0 ? (
        <StateMessage title={t("noResults.title")} text={t("noResults.text")}>
          <Button type="button" variant="outline" onClick={() => setQuery("")}>
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
