import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Shared with Select so both controls look and size identically.
const controlClasses =
  "min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-body text-fg placeholder:text-fg-subtle disabled:bg-surface-muted disabled:text-fg-subtle aria-invalid:border-error";

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(controlClasses, className)} {...props} />;
}

export { Input, controlClasses };
