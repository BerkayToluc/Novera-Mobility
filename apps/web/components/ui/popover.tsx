"use client";

import type { ComponentProps } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

// Floating layers are the one place SPEC §5.3 allows a shadow.
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        // Keeps the panel inside the 16px page gutter on a 375px screen.
        collisionPadding={16}
        className={cn(
          // The panel is position:fixed, so on a short screen it would run off the bottom
          // with no way to scroll to it; cap it to the space that is actually available.
          "z-50 max-h-(--radix-popover-content-available-height) max-w-(--radix-popover-content-available-width) rounded-card border border-border bg-surface p-4 text-fg shadow-overlay outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
