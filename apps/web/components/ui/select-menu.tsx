"use client";

import type { ComponentProps } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./input";

// Custom listbox, used only where a control must live inside a popover (the date
// picker's month and year). Plain forms use the native `Select` instead.
const SelectMenu = SelectPrimitive.Root;
const SelectMenuValue = SelectPrimitive.Value;

function SelectMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(controlClasses, "flex items-center justify-between gap-2 text-left", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectMenuContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={4}
        collisionPadding={16}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-control border border-border bg-surface text-fg shadow-overlay",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectMenuItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-11 w-full cursor-pointer select-none items-center rounded-control py-2 pl-9 pr-3 text-body outline-none",
        "data-highlighted:bg-selected data-highlighted:text-on-selected data-disabled:pointer-events-none data-disabled:text-fg-subtle",
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { SelectMenu, SelectMenuValue, SelectMenuTrigger, SelectMenuContent, SelectMenuItem };
