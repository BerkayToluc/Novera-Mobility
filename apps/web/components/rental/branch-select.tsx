"use client";

import { useState, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
} from "@/components/ui/select-menu";
import type { BranchOption } from "@/lib/branch-options";
import { openingStatus } from "@/lib/opening-status";

type BranchSelectProps = {
  options: BranchOption[];
  value: string;
  onChange: (branchId: string) => void;
  id?: string;
  labelledBy?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

// A branch list where each option also says whether the branch is open, so the choice of branch
// answers "can I get there now". The status is read when the list opens, in Turkey's time.
export function BranchSelect({ options, value, onChange, id, labelledBy, ref, ...aria }: BranchSelectProps) {
  const t = useTranslations("RentalSearch.status");
  const locale = useLocale();
  const [now, setNow] = useState(() => new Date());

  // A date that falls on the weekday, for the day's name in the visitor's language.
  const dayName = (weekday: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));

  function status(option: BranchOption) {
    const result = openingStatus(option.openingHours, now);
    if (result.state === "always") return t("always");
    if (result.state === "open") return t("open", { time: result.until });
    if (result.state === "closed-for-good") return t("closedForGood");
    const when = result.daysAhead === 0 ? t("today") : result.daysAhead === 1 ? t("tomorrow") : dayName(result.weekday);
    return t("closed", { when, time: result.opensAt });
  }

  return (
    <SelectMenu
      value={value || undefined}
      onValueChange={onChange}
      onOpenChange={(open) => {
        if (open) setNow(new Date());
      }}
    >
      <SelectMenuTrigger
        ref={ref}
        id={id}
        aria-labelledby={labelledBy}
        className="data-placeholder:text-fg-subtle"
        {...aria}
      >
        <SelectMenuValue placeholder={t("placeholder")} />
      </SelectMenuTrigger>
      <SelectMenuContent>
        {options.map((option) => (
          <SelectMenuItem key={option.id} value={option.id} description={status(option)}>
            {option.label}
          </SelectMenuItem>
        ))}
      </SelectMenuContent>
    </SelectMenu>
  );
}
