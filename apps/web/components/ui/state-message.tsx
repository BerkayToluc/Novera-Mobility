import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StateMessageProps = {
  title: string;
  text?: string;
  // "error" announces itself to screen readers; "empty" is just content.
  tone?: "empty" | "error";
  children?: ReactNode;
  className?: string;
};

// One look for the states every data-driven view needs besides "loaded" (CLAUDE.md):
// nothing to show yet, and something went wrong.
export function StateMessage({ title, text, tone = "empty", children, className }: StateMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border p-6 md:p-8",
        tone === "error" ? "border-error" : "border-border bg-surface-muted",
        className,
      )}
    >
      <h2 className="text-h3 text-fg">{title}</h2>
      {text && <p className="max-w-prose text-body text-fg-muted">{text}</p>}
      {children}
    </div>
  );
}
