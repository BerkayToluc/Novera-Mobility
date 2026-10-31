import { isMonth, MAX_REPORT_MONTHS, monthsBetween, previousMonth, type FleetReport } from "./report-calc";

// The report screen (V2-39, docs/FLEET.md §3): which months the address asks for, and the little arithmetic of the bars. Pure, so the same
// rules are tested without a browser. Money is TRY kuruş.
export type { FleetReport };
export const PERIOD_CHOICES = ["bu-ay", "son-3-ay", "bu-yil", "ozel"] as const;
export type PeriodChoice = (typeof PERIOD_CHOICES)[number];
export const DEFAULT_PERIOD: PeriodChoice = "son-3-ay";

export type ReportRange = { choice: PeriodChoice; from: string; to: string };

// What the address asks for: `donem` is one of the four choices; for "ozel" the months are `bas` and `bit` ("2026-08"). `thisMonth` is the
// Istanbul month of today. A choice that is not one, or custom months that make no sense (not months, the wrong way round, in the future,
// more than 24), fall back to the default, so a made-up address shows a report instead of an error.
export function parseReportRange(raw: { donem?: string; bas?: string; bit?: string }, thisMonth: string): ReportRange {
  const fallback = (): ReportRange => ({ choice: DEFAULT_PERIOD, from: previousMonth(thisMonth, 2), to: thisMonth });
  const choice = (PERIOD_CHOICES as readonly string[]).includes(raw.donem ?? "") ? (raw.donem as PeriodChoice) : DEFAULT_PERIOD;
  if (choice === "bu-ay") return { choice, from: thisMonth, to: thisMonth };
  if (choice === "bu-yil") return { choice, from: `${thisMonth.slice(0, 4)}-01`, to: thisMonth };
  if (choice === "son-3-ay") return fallback();
  const { bas, bit } = raw;
  if (!bas || !bit || !isMonth(bas) || !isMonth(bit) || bas > bit || bit > thisMonth || monthsBetween(bas, bit).length > MAX_REPORT_MONTHS) return fallback();
  return { choice, from: bas, to: bit };
}

// "2026-10" in the reader's language ("Ekim 2026", "October 2026"); short for the rows of a chart ("Eki 26").
export const monthLabel = (period: string, locale: string, style: "long" | "short" = "long"): string =>
  new Intl.DateTimeFormat(locale, style === "long" ? { month: "long", year: "numeric", timeZone: "UTC" } : { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));

export type BarSegment = { value: number };
export type BarRow = { key: string; label: string; segments: number[] };

// How wide each segment of a bar is, in percent of the longest bar: bars share one scale, so they can be compared. A row of nothing is
// zero wide, and a segment too small to see is still given a sliver so it is not mistaken for none.
export function barWidths(rows: ReadonlyArray<{ segments: readonly number[] }>): number[][] {
  const longest = Math.max(0, ...rows.map((row) => row.segments.reduce((sum, value) => sum + value, 0)));
  return rows.map((row) =>
    row.segments.map((value) => {
      if (value <= 0 || longest === 0) return 0;
      return Math.max(0.8, (value / longest) * 100);
    }),
  );
}
