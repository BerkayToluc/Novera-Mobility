"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  // Accessible name of the group, e.g. "Rental type". Not shown visually.
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // "contained": options inside one pill-shaped track. "bare": two free-standing buttons,
  // no track around them (the home page's audience choice, SPEC §2.2).
  variant?: "contained" | "bare";
  className?: string;
};

// Native radio inputs: arrow keys, the selected state and the group name come from
// the browser, so screen readers announce "selected" without any ARIA of our own.
function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = "contained",
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  const bare = variant === "bare";

  return (
    <fieldset
      className={cn(
        "inline-flex",
        bare ? "gap-3" : "gap-1 rounded-full border border-border bg-surface-muted p-1",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full text-label transition-colors",
              "peer-checked:bg-primary peer-checked:text-on-primary",
              // The radio itself is visually hidden, so the focus ring is drawn on its label.
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              bare
                ? "min-w-36 border border-border-strong px-6 text-fg peer-checked:border-primary peer-not-checked:hover:bg-selected"
                : "px-5 text-fg-muted hover:text-fg",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export { SegmentedControl };
