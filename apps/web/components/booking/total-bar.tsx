import type { ReactNode } from "react";

// Below xl the price panel sits at the end of a long page, so the total (and, on the summary,
// the way on) stays pinned to the bottom of the screen while the page is read. It is the last
// child of the page container: sticky holds it to the viewport until the container ends, where
// it rests above the footer. From xl the price panel is already beside the content.
export function TotalBar({ label, amount, children }: { label: string; amount: string; children?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-4 border-t border-border bg-surface px-4 py-3 md:-mx-8 md:px-8 xl:hidden">
      <p className="flex flex-col">
        <span className="text-small text-fg-muted">{label}</span>
        <span className="text-h3 tabular-nums text-fg">{amount}</span>
      </p>
      {children}
    </div>
  );
}
