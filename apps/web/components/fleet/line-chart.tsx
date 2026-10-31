import { lineGeometry, type LinePoint } from "@/lib/green";
import { cn } from "@/lib/cn";

// Four looks a line can have. The colour is never the only thing that tells two lines apart: each also has its own dash, and the legend
// shows both and the last value of the line.
export const LINE_LOOKS = [
  { stroke: "stroke-primary", dash: undefined },
  { stroke: "stroke-accent", dash: "4 2" },
  { stroke: "stroke-fg-muted", dash: "1 2" },
  { stroke: "stroke-fg", dash: "6 2 1 2" },
] as const;

export type ChartLine = { key: string; label: string; points: LinePoint[] };

type Props = {
  title: string;
  lines: readonly ChartLine[];
  // The words for the ends of the axes, written in the reader's language by the caller.
  percent: (value: number) => string;
  date: (iso: number) => string;
  lastValue: (line: ChartLine) => string;
  note: string;
  children: React.ReactNode;
};

// A line chart of the Green Fleet (V2-40, DESIGN.md §8): plain lines on one scale, at most four (the look of a fifth would repeat), colours
// from the brand palette, and under it the table of the very same numbers. Drawn in SVG without a library. The picture is hidden from
// assistive technology on purpose: a screen reader reads the table, which says more.
export function LineChart({ title, lines, percent, date, lastValue, note, children }: Props) {
  const shown = lines.slice(0, LINE_LOOKS.length);
  const { floor, first, last, points } = lineGeometry(shown.map((line) => line.points));
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 md:p-6">
      <figcaption className="text-h3 text-fg">{title}</figcaption>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-5 gap-y-1 text-small text-fg-muted">
        {shown.map((line, index) => (
          <li key={line.key} className="flex items-center gap-2">
            <svg viewBox="0 0 24 4" className="h-1 w-6 shrink-0" aria-hidden="true">
              <line x1="0" y1="2" x2="24" y2="2" strokeWidth="2" strokeDasharray={LINE_LOOKS[index]!.dash} className={LINE_LOOKS[index]!.stroke} />
            </svg>
            <span className="text-fg">{line.label}</span>
            <span className="tabular-nums">{lastValue(line)}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="flex gap-2 text-small text-fg-muted">
        <div className="flex flex-col justify-between py-0.5 text-right tabular-nums">
          <span>{percent(100)}</span>
          <span>{percent(floor)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-40 w-full rounded-control bg-surface-muted">
            {shown.map((line, index) => (
              <polyline
                key={line.key}
                points={points[index]!.map((point) => `${point.x},${(point.y / 100) * 50}`).join(" ")}
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={LINE_LOOKS[index]!.dash}
                vectorEffect="non-scaling-stroke"
                className={cn(LINE_LOOKS[index]!.stroke)}
              />
            ))}
          </svg>
          <div className="flex justify-between">
            <span>{date(first)}</span>
            <span>{date(last)}</span>
          </div>
        </div>
      </div>
      <p className="text-small text-fg-muted">{note}</p>
      {children}
    </figure>
  );
}
