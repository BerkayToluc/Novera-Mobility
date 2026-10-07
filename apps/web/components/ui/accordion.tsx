import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

function Accordion({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y divide-border rounded-card border border-border bg-surface", className)}
      {...props}
    />
  );
}

type AccordionItemProps = Omit<ComponentProps<"details">, "title"> & {
  title: ReactNode;
  // Items sharing a `name` behave as a group: opening one closes the others.
  name?: string;
};

// Native <details>: keyboard (Enter/Space), expanded state, and in-page search
// into collapsed text all work without JavaScript. The 44px summary is the touch target.
function AccordionItem({ title, children, className, ...props }: AccordionItemProps) {
  return (
    <details className={cn("group", className)} {...props}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-fg marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="text-body font-semibold">{title}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pb-5 text-body text-fg-muted">{children}</div>
    </details>
  );
}

export { Accordion, AccordionItem };
