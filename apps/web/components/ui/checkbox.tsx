import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  children: ReactNode;
};

// The whole row is the label, so the touch target is 44px high even though the box is small.
export function Checkbox({ children, className, ...props }: CheckboxProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        className={cn("mt-0.5 size-5 shrink-0 rounded-control border-border-strong aria-invalid:outline-error", className)}
        {...props}
      />
      <span className="text-body text-fg">{children}</span>
    </label>
  );
}
