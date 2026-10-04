"use client";

import type { ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type ChevronProps } from "react-day-picker";
import { cn } from "@/lib/cn";

type CalendarProps = ComponentProps<typeof DayPicker>;

function CalendarChevron({ orientation }: ChevronProps) {
  const Icon = orientation === "right" ? ChevronRight : ChevronLeft;
  return <Icon aria-hidden="true" className="size-5" />;
}

// Cells are 44px (size-11): seven columns are 308px, which fits a 375px screen
// inside the 16px gutter and meets the touch target minimum.
function Calendar({ className, classNames, showOutsideDays = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      // Monday first in both languages: rental weeks run Monday to Sunday in Turkey.
      weekStartsOn={1}
      className={cn("w-fit", className)}
      classNames={{
        months: "relative",
        month: "flex flex-col gap-2",
        month_caption: "flex h-11 items-center justify-center",
        caption_label: "text-label text-fg",
        nav: "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "pointer-events-auto inline-flex size-11 items-center justify-center rounded-control text-fg enabled:hover:bg-selected disabled:text-fg-subtle",
        button_next:
          "pointer-events-auto inline-flex size-11 items-center justify-center rounded-control text-fg enabled:hover:bg-selected disabled:text-fg-subtle",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex size-11 items-center justify-center text-small text-fg-subtle",
        week: "flex",
        day: "size-11 p-0 text-center",
        day_button:
          "size-11 rounded-control text-body text-fg enabled:hover:bg-selected disabled:cursor-not-allowed",
        // The band behind a range lives on the cell; the end points get a solid button on top of it.
        range_start:
          "rounded-l-control bg-selected [&>button]:bg-primary [&>button]:text-on-primary [&>button]:hover:bg-primary-hover",
        range_end:
          "rounded-r-control bg-selected [&>button]:bg-primary [&>button]:text-on-primary [&>button]:hover:bg-primary-hover",
        range_middle: "bg-selected [&>button]:text-on-selected [&>button]:hover:bg-transparent",
        // Today is marked by an outline, not colour alone (WCAG 1.4.1).
        today: "[&>button]:border [&>button]:border-border-strong",
        // Struck through as well as dimmed, so unavailable days read as such without colour.
        disabled: "[&>button]:text-fg-subtle [&>button]:line-through",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
}

export { Calendar };
