"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";

export type ResultsView = "list" | "grid";

// List or grid (SPEC §2.3, G): one button that changes the view each time it is pressed, showing
// the picture of the view it will switch to. The same results as wide rows, one under the other, or
// as cards three across. Kept in the address (gorunum=izgara; the list is the default and leaves no
// trace), next to the filters and the search, so a shared link opens the same way.
export function ResultsViewToggle({ view }: { view: ResultsView }) {
  const t = useTranslations("ResultsPage.view");
  const router = useRouter();
  const current = useSearchParams();

  const next: ResultsView = view === "list" ? "grid" : "list";
  const label = next === "grid" ? t("toGrid") : t("toList");
  const Icon = next === "grid" ? LayoutGrid : Rows3;

  function change() {
    const query: Record<string, string> = {};
    current.forEach((value, key) => {
      if (key !== "gorunum") query[key] = value;
    });
    if (next === "grid") query.gorunum = "izgara";
    router.replace({ pathname: "/araclar", query }, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={change}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-fg transition-colors hover:bg-selected"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
