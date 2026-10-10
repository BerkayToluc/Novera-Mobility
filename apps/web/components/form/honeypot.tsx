import type { ComponentProps } from "react";

// Spam trap (ARCHITECTURE ADR-20): a field people never see or reach, which form-filling bots
// complete. Visually hidden rather than display:none, since some bots skip hidden inputs; out
// of the tab order and the accessibility tree so no keyboard or screen reader user lands in it.
export function Honeypot(props: Omit<ComponentProps<"input">, "type" | "tabIndex" | "autoComplete">) {
  return (
    <div aria-hidden="true" className="sr-only">
      <input type="text" tabIndex={-1} autoComplete="off" {...props} />
    </div>
  );
}
