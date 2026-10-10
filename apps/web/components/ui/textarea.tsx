import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./input";

// Same look as Input, taller and resizable only in height so it cannot break the layout.
function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClasses, "resize-y py-2", className)} {...props} />;
}

export { Textarea };
