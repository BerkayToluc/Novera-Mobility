"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { FleetCategory, FleetModel } from "@/lib/fleet-models";
import { FleetDialog } from "./fleet-dialog";
import { FleetModelCard } from "./fleet-model-card";

const ALL = "all";
const PARAM = "arac";

// The fleet page's interactive part (SPEC §2.4): category chips on top, one clearly headed
// section per category, and the model dialog. The open model lives in the address as
// `?arac=<slug>` (ARCHITECTURE ADR-22), written with the History API so nothing is fetched
// again: a shared link opens the same dialog, Back closes it, Escape closes it.
export function FleetExplorer({
  categories,
  initialModel,
}: {
  categories: FleetCategory[];
  initialModel: string | null;
}) {
  const t = useTranslations("FleetPage");
  const [filter, setFilter] = useState<string>(ALL);
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
    window.history.pushState({ fleetDialog: true }, "", `${window.location.pathname}?${PARAM}=${slug}`);
    setOpenSlug(slug);
  }

  // The dialog closed itself (Escape, the backdrop, the close button). If we pushed the
  // entry, step back so Back does not reopen it; if the page was opened on the link, there is
  // nothing to step back to, so the address is rewritten instead.
  function onDialogClosed() {
    if (openRef.current === null) return;
    if (window.history.state?.fleetDialog) window.history.back();
    else {
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setOpenSlug(null);
    }
  }

  const visible = filter === ALL ? categories : categories.filter((category) => category.slug === filter);
  const total = categories.reduce((sum, category) => sum + category.models.length, 0);

  return (
    <>
      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        <Chip active={filter === ALL} onClick={() => setFilter(ALL)} label={t("all")} count={total} />
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

      <div className="flex flex-col gap-16">
        {visible.map((category) => (
          <section key={category.slug} aria-labelledby={`class-${category.slug}`} className="flex flex-col gap-6">
            <header className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
              <h2 id={`class-${category.slug}`} className="text-h2 text-fg">
                {category.name}
              </h2>
              <p className="text-small text-fg-muted">{t("modelCount", { count: category.models.length })}</p>
            </header>
            <ul className="grid gap-4 xl:grid-cols-2">
              {category.models.map((model) => (
                <li key={model.slug}>
                  <FleetModelCard model={model} onOpen={() => open(model.slug)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <FleetDialog
        model={openSlug ? (models.get(openSlug) ?? null) : null}
        onClose={onDialogClosed}
        className="fleet-dialog m-auto w-[min(44rem,calc(100%-2rem))] max-w-none rounded-card border border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-band/60"
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
