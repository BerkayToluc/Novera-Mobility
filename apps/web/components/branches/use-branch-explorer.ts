"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { SearchableOption } from "@/components/ui/searchable-select";
import {
  branchKind,
  inCity,
  matchesBranch,
  type BranchDetail,
  type BranchKind,
} from "@/lib/branch-detail";
import { distanceKm, type Position } from "@/lib/nearest-branch";

// The state of the branch page, split by what it is about (V2-14, QUALITY M-07: one component held 14 hooks).

export type Kind = "" | BranchKind;
export const KINDS: Kind[] = ["", "airport", "city"];

// Same width as the header's inline menu: from here the list and the map sit side by side.
const DESKTOP_QUERY = "(min-width: 80rem)";

export function useIsDesktop() {
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

// The time the open/closed words are read at: null on the server and in the first render, then the
// browser's clock, a minute at a time. So the server's page never carries a clock the browser would
// then disagree with.
export function useMinuteClock(): Date | null {
  const minute = useSyncExternalStore(
    (notify) => {
      const timer = setInterval(notify, 60_000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
  return useMemo(() => (minute === null ? null : new Date(minute)), [minute]);
}

// "Nearest first": where the visitor is, once they have asked for it; kept here and nowhere else.
type Locate = {
  state: "idle" | "locating" | "active" | "denied" | "failed" | "unsupported";
};

export function useNearest(onLocated: () => void) {
  const [position, setPosition] = useState<Position | null>(null);
  const [locate, setLocate] = useState<Locate>({ state: "idle" });

  function findNearest() {
    if (!("geolocation" in navigator)) {
      setLocate({ state: "unsupported" });
      return;
    }
    setLocate({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
        setLocate({ state: "active" });
        onLocated();
      },
      (error) =>
        setLocate({
          state: error.code === error.PERMISSION_DENIED ? "denied" : "failed",
        }),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function stopNearest() {
    setPosition(null);
    setLocate({ state: "idle" });
  }

  return { position, locate, findNearest, stopNearest };
}

// The city, the text and the kind of branch the list is narrowed to, what they leave, and their counts.
export function useBranchFilters(
  branches: BranchDetail[],
  position: Position | null,
) {
  const t = useTranslations("BranchesPage");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [kind, setKind] = useState<Kind>("");

  // Cities in the order the branches come, each once, with how many branches each has; "all cities" first.
  const cityOptions = useMemo<SearchableOption[]>(() => {
    const counts = new Map<string, number>();
    for (const branch of branches)
      counts.set(branch.city, (counts.get(branch.city) ?? 0) + 1);
    return [
      {
        value: "",
        label: t("allCities"),
        hint: t("count", { count: branches.length }),
      },
      ...[...counts].map(([name, count]) => ({
        value: name,
        label: name,
        hint: t("count", { count }),
      })),
    ];
  }, [branches, t]);
  const kindCounts = useMemo(
    () => ({
      "": branches.length,
      airport: branches.filter((branch) => branchKind(branch) === "airport")
        .length,
      city: branches.filter((branch) => branchKind(branch) === "city").length,
    }),
    [branches],
  );
  const matches = useMemo(() => {
    const found = branches.filter(
      (branch) =>
        inCity(branch, city) &&
        matchesBranch(branch, query) &&
        (kind === "" || branchKind(branch) === kind),
    );
    // Nearest first once the visitor has shared where they are.
    return position
      ? [...found].sort(
          (a, b) => distanceKm(position, a) - distanceKm(position, b),
        )
      : found;
  }, [branches, city, query, kind, position]);

  return {
    query,
    setQuery,
    city,
    setCity,
    kind,
    setKind,
    cityOptions,
    kindCounts,
    matches,
    filtered: city !== "" || query !== "" || kind !== "",
    clear() {
      setQuery("");
      setCity("");
      setKind("");
    },
  };
}
