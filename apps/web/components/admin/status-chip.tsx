import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "error" | "neutral";

// The colour is never the only thing that says the status (DESIGN.md §8): the word is always there, and the dot is only
// decoration. `primary` is not used here, it is a fill colour (dark theme contrast).
const TONES: Record<StatusTone, string> = {
  success: "border-success text-success",
  warning: "border-warning text-warning",
  error: "border-error text-error",
  neutral: "border-border-strong text-fg-muted",
};

export function StatusChip({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-surface px-2.5 py-1 text-small", TONES[tone])}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
