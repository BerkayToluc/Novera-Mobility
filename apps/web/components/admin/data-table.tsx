import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { Sort, SortDir } from "@/lib/admin-query";
import { cn } from "@/lib/cn";
import type { Href } from "./types";

export type Column<T> = {
  // Also the API's sort key when the column is sortable.
  key: string;
  header: string;
  sortable?: boolean;
  // Numbers: right-aligned, in figures of equal width.
  align?: "right";
  cell: (row: T) => ReactNode;
};

type Props<T> = {
  // Names the table for assistive technology; it is also the name of the box that scrolls sideways.
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  // The first column of a row becomes its link.
  rowHref?: (row: T) => Href;
  sort?: Sort | null;
  // The address a sortable header leads to: the sort is in the address, so it can be shared.
  sortHref?: (key: string, dir: SortDir) => Href;
  state?: "ready" | "loading" | "error";
  empty?: { title: string; text?: string; action?: ReactNode };
  error?: { title?: string; text?: string; action?: ReactNode };
};

const SKELETON_ROWS = 5;

// The list of every panel screen (ADMIN.md §3.4): sortable headers with `aria-sort`, a link in the first column, and
// the three states every data view has (CLAUDE.md): loading, empty and error. A table wider than the screen scrolls in
// its own box, which can be focused so a keyboard can scroll it.
export function DataTable<T>({ caption, columns, rows, rowKey, rowHref, sort, sortHref, state = "ready", empty, error }: Props<T>) {
  const t = useTranslations("Admin.table");

  if (state === "error") {
    return (
      <StateMessage tone="error" title={error?.title ?? t("errorTitle")} text={error?.text ?? t("errorText")}>
        {error?.action}
      </StateMessage>
    );
  }
  if (state === "ready" && rows.length === 0) {
    return (
      <StateMessage title={empty?.title ?? t("emptyTitle")} text={empty?.text}>
        {empty?.action}
      </StateMessage>
    );
  }

  const loading = state === "loading";
  return (
    <div
      role="region"
      aria-label={t("scrollable", { table: caption })}
      aria-busy={loading || undefined}
      // A scrolling box must be reachable by keyboard (axe: scrollable-region-focusable).
      tabIndex={0}
      className="overflow-x-auto rounded-card border border-border bg-surface"
    >
      <table className="w-full min-w-max border-collapse text-left text-body text-fg">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={cn("border-b border-border px-4 py-1 text-label text-fg-muted", column.align === "right" && "text-right")}
                >
                  {column.sortable && sortHref ? (
                    <Link
                      href={sortHref(column.key, active && sort!.dir === "asc" ? "desc" : "asc")}
                      aria-label={t("sortBy", { column: column.header })}
                      className={cn("inline-flex min-h-11 items-center gap-1 hover:text-fg", column.align === "right" && "flex-row-reverse")}
                    >
                      {column.header}
                      {active ? (
                        sort!.dir === "asc" ? <ArrowUp aria-hidden="true" className="size-4" /> : <ArrowDown aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronsUpDown aria-hidden="true" className="size-4" />
                      )}
                    </Link>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} className="border-t border-border first:border-t-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <span aria-hidden="true" className="block h-4 w-full max-w-32 rounded-control bg-surface-muted" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border first:border-t-0">
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn("px-4 py-2 align-middle", column.align === "right" && "text-right tabular-nums")}
                    >
                      {index === 0 && rowHref ? (
                        <Link href={rowHref(row)} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {loading && (
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
      )}
    </div>
  );
}
