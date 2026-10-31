import { barWidths, type BarRow } from "@/lib/reports";
import { cn } from "@/lib/cn";

// `fill` colours the bar and `swatch` the legend dot; both are written out in full so the style sheet finds them.
export type ChartSeries = { label: string; fill: string; swatch: string };
type Props = {
  // What the chart is called; the same words name the table under it.
  title: string;
  // One bar per row; a row has one number per series, stacked from the left.
  series: readonly ChartSeries[];
  rows: readonly BarRow[];
  // The number at the end of a bar, written in the reader's language.
  format: (value: number) => string;
  // The table of the same data, shown under the chart (the chart itself is a picture; this is what is read).
  children: React.ReactNode;
  note: string;
};

// A bar chart of the report (V2-39, DESIGN.md §8): plain horizontal bars on one scale, at most four series, colours from the brand palette,
// and under it the table of the very same numbers. The bars are drawn in SVG without a library (no dependency, no extra script on the
// route). The picture is hidden from assistive technology on purpose: a screen reader reads the table, which says more, and a legend says
// which colour is which for those who see it. The colour is never the only thing: the number is written at the end of every bar.
export function BarChart({ title, series, rows, format, children, note }: Props) {
  const widths = barWidths(rows);
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 md:p-6">
      <figcaption className="text-h3 text-fg">{title}</figcaption>
      {series.length > 1 && (
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-small text-fg-muted">
          {series.map((entry) => (
            <li key={entry.label} className="flex items-center gap-2">
              <span className={cn("size-3 shrink-0 rounded-control", entry.swatch)} />
              {entry.label}
            </li>
          ))}
        </ul>
      )}
      <ol aria-hidden="true" className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-center gap-3 text-small">
            <span className="w-24 shrink-0 truncate text-fg md:w-36">{row.label}</span>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-4 min-w-0 flex-1 rounded-control bg-surface-muted">
              {row.segments.map((value, segment) => {
                const before = widths[index]!.slice(0, segment).reduce((sum, width) => sum + width, 0);
                return <rect key={segment} x={before} y={0} width={widths[index]![segment]} height={6} className={series[segment]!.fill} />;
              })}
            </svg>
            <span className="shrink-0 text-right tabular-nums text-fg">{format(row.segments.reduce((sum, value) => sum + value, 0))}</span>
          </li>
        ))}
      </ol>
      <p className="text-small text-fg-muted">{note}</p>
      {children}
    </figure>
  );
}
