"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type ResultsView = "list" | "grid";

// List or grid (SPEC §2.3, G): the same results as wide rows, one under the other, or as cards
// three across. Kept in the address (gorunum=izgara; the list is the default and leaves no trace),
// next to the filters and the search, so a shared link opens the same way.
export function ResultsViewToggle({ view }: { view: ResultsView }) {
  const t = useTranslations("ResultsPage.view");
  const router = useRouter();
  const current = useSearchParams();

  function choose(next: ResultsView) {
    if (next === view) return;
    const query: Record<string, string> = {};
    current.forEach((value, key) => {
      if (key !== "gorunum") query[key] = value;
    });
    if (next === "grid") query.gorunum = "izgara";
    router.replace({ pathname: "/araclar", query }, { scroll: false });
  }

  const options = [
    { value: "list" as const, icon: Rows3, label: t("list") },
    { value: "grid" as const, icon: LayoutGrid, label: t("grid") },
  ];

  return (
    <div role="group" aria-label={t("label")} className="inline-flex rounded-control border border-border-strong bg-surface p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-control transition-colors",
            view === value ? "bg-primary text-on-primary" : "text-fg hover:bg-selected",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      ))}
    </div>
  );
}
