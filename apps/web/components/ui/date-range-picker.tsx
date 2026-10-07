"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addYears, format, startOfDay, startOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { enUS, tr } from "react-day-picker/locale";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { controlClasses } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
} from "./select-menu";

const LOCALES = { tr, en: enUS } as const;

// A rental is booked at most two years ahead; a longer list of years would only
// make the dropdown harder to scan.
const MAX_YEARS_AHEAD = 2;

type DateRangePickerProps = {
  value: DateRange | undefined;
  // Called on "Apply" or "Clear" only, so a half-picked range never reaches the form.
  onChange: (range: DateRange | undefined) => void;
  id?: string;
  // Id of the visible label (see Field); the trigger is named by label + current value.
  labelledBy?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
  className?: string;
};

function DateRangePicker({
  value,
  onChange,
  id,
  labelledBy,
  disabled,
  className,
  ...aria
}: DateRangePickerProps) {
  const t = useTranslations("DateRangePicker");
  const locale = useLocale() as keyof typeof LOCALES;
  const dateLocale = LOCALES[locale];
  const valueId = useId();

  const today = startOfDay(new Date());
  const lastDay = addYears(today, MAX_YEARS_AHEAD);
  const firstMonth = startOfMonth(today);
  const lastMonth = startOfMonth(lastDay);

  const [open, setOpen] = useState(false);
  // The range is edited as a draft and only committed on "Apply".
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const [month, setMonth] = useState(firstMonth);

  const formatDate = (date: Date) => format(date, "d MMM yyyy", { locale: dateLocale });
  const formattedValue = value?.from
    ? value.to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : formatDate(value.from)
    : t("placeholder");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
      setMonth(startOfMonth(value?.from ?? today));
    }
    setOpen(nextOpen);
  }

  function clampMonth(date: Date) {
    if (date < firstMonth) return firstMonth;
    if (date > lastMonth) return lastMonth;
    return date;
  }

  const years = Array.from(
    { length: lastMonth.getFullYear() - firstMonth.getFullYear() + 1 },
    (_, index) => firstMonth.getFullYear() + index,
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
          className={cn(controlClasses, "flex items-center gap-2 text-left", className)}
          {...aria}
        >
          <CalendarIcon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
          <span
            id={valueId}
            className={cn("truncate", !value?.from && "text-fg-subtle")}
          >
            {formattedValue}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex flex-col gap-4">
        {/* Only the pickers scroll; "Clear" and "Apply" stay reachable on short screens. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <SelectMenu
              value={String(month.getMonth())}
              onValueChange={(next) => setMonth(clampMonth(new Date(month.getFullYear(), Number(next), 1)))}
            >
              <SelectMenuTrigger aria-label={t("month")}>
                <SelectMenuValue />
              </SelectMenuTrigger>
              <SelectMenuContent>
                {Array.from({ length: 12 }, (_, index) => {
                  const unavailable =
                    new Date(month.getFullYear(), index, 1) < firstMonth ||
                    new Date(month.getFullYear(), index, 1) > lastMonth;
                  return (
                    <SelectMenuItem key={index} value={String(index)} disabled={unavailable}>
                      {format(new Date(2000, index, 1), "LLLL", { locale: dateLocale })}
                    </SelectMenuItem>
                  );
                })}
              </SelectMenuContent>
            </SelectMenu>

            <SelectMenu
              value={String(month.getFullYear())}
              onValueChange={(next) => setMonth(clampMonth(new Date(Number(next), month.getMonth(), 1)))}
            >
              <SelectMenuTrigger aria-label={t("year")}>
                <SelectMenuValue />
              </SelectMenuTrigger>
              <SelectMenuContent>
                {years.map((year) => (
                  <SelectMenuItem key={year} value={String(year)}>
                    {year}
                  </SelectMenuItem>
                ))}
              </SelectMenuContent>
            </SelectMenu>
          </div>

          <Calendar
            mode="range"
            locale={dateLocale}
            selected={draft}
            onSelect={setDraft}
            month={month}
            onMonthChange={setMonth}
            startMonth={firstMonth}
            endMonth={lastMonth}
            disabled={{ before: today, after: lastDay }}
          />
        </div>

        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            disabled={!draft && !value}
            onClick={() => {
              setDraft(undefined);
              onChange(undefined);
            }}
          >
            {t("clear")}
          </Button>
          <Button
            disabled={!draft?.from}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateRangePicker };
