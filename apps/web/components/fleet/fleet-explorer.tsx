"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { FleetCategory, FleetModel } from "@/lib/fleet-models";
import { FleetDialog } from "./fleet-dialog";
import { FleetModelCard } from "./fleet-model-card";

const PARAM = "arac";

// The fleet section's interactive part (SPEC §2.4): category chips on top, the models of the
// chosen category below (the first one to begin with; there is no "all"), and the model dialog.
// The open model lives in the address as `?arac=<slug>` (ARCHITECTURE ADR-22), written with the
// History API so nothing is fetched again: a shared link opens the same dialog, Back closes it,
// Escape closes it. The rest of the query string (the home page's `?tip=`) is left alone.
export function FleetExplorer({
  categories,
  initialModel,
}: {
  categories: FleetCategory[];
  initialModel: string | null;
}) {
  const t = useTranslations("FleetPage");
  // A shared link to a model starts on that model's category, so the card is there behind the dialog.
  const [filter, setFilter] = useState<string>(
    () => categories.find((category) => category.models.some((model) => model.slug === initialModel))?.slug ?? categories[0].slug,
  );
  const [openSlug, setOpenSlug] = useState<string | null>(initialModel);

  const models = new Map<string, FleetModel>();
  for (const category of categories) for (const model of category.models) models.set(model.slug, model);
  const modelsRef = useRef(models);
  const openRef = useRef(openSlug);
  useEffect(() => {
    modelsRef.current = models;
    openRef.current = openSlug;
  });

  // Back and Forward move between "dialog open" and "dialog closed" entries.
  useEffect(() => {
    const onPop = () => {
      const slug = new URLSearchParams(window.location.search).get(PARAM);
      setOpenSlug(slug && modelsRef.current.has(slug) ? slug : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function open(slug: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, slug);
    window.history.pushState({ fleetDialog: true }, "", url.pathname + url.search + url.hash);
    setOpenSlug(slug);
  }

  // The dialog closed itself (Escape, the backdrop, the close button). If we pushed the
  // entry, step back so Back does not reopen it; if the page was opened on the link, there is
  // nothing to step back to, so the address is rewritten instead.
  function onDialogClosed() {
    if (openRef.current === null) return;
    if (window.history.state?.fleetDialog) window.history.back();
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAM);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      setOpenSlug(null);
    }
  }

  const chosen = categories.find((category) => category.slug === filter) ?? categories[0];

  return (
    <>
      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Chip
            key={category.slug}
            active={filter === category.slug}
            onClick={() => setFilter(category.slug)}
            label={category.name}
            count={category.models.length}
          />
        ))}
      </div>

      <ul aria-label={chosen.name} className="flex flex-col gap-4">
        {chosen.models.map((model) => (
          <li key={model.slug}>
            <FleetModelCard model={model} onOpen={() => open(model.slug)} />
          </li>
        ))}
      </ul>

      <FleetDialog
        model={openSlug ? (models.get(openSlug) ?? null) : null}
        onClose={onDialogClosed}
        className="fleet-dialog m-auto w-dialog-wide max-w-none rounded-card border border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-band/60"
      />
    </>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-border-strong text-fg hover:bg-selected",
      )}
    >
      {label}
      <span aria-hidden="true" className={cn("text-small tabular-nums", active ? "text-on-primary" : "text-fg-muted")}>
        {count}
      </span>
    </button>
  );
}
