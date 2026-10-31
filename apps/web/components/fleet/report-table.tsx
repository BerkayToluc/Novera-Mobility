import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ReportColumn<T> = { key: string; header: string; align?: "right"; cell: (row: T) => ReactNode };

type Props<T> = {
  caption: string;
  // Names the box that scrolls sideways (a table wider than the screen scrolls in its own box, which a keyboard can focus).
  scrollLabel: string;
  columns: readonly ReportColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  // A last row of totals, one cell per column.
  footer?: ReactNode[];
};

// The table under a chart of the report (V2-39): the same numbers as the bars, in the order of the bars, with a row of totals. It is what a
// screen reader reads and what a keyboard user scrolls, so it has a caption, header cells with scope, and a focusable scrolling box.
export function ReportTable<T>({ caption, scrollLabel, columns, rows, rowKey, footer }: Props<T>) {
  return (
    <div role="region" aria-label={scrollLabel} tabIndex={0} className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-max border-collapse text-left text-body text-fg">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("border-b border-border px-4 py-2 text-label text-fg-muted", column.align === "right" && "text-right")}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-border first:border-t-0">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.key} scope="row" className="px-4 py-2 text-left font-normal">
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={column.key} className={cn("px-4 py-2", column.align === "right" && "text-right tabular-nums")}>
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-border-strong">
              {footer.map((cell, index) => (
                <td key={index} className={cn("px-4 py-2 text-label", index > 0 && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
