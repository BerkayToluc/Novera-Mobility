"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import {
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
} from "@/components/ui/select-menu";
import type { BranchOption } from "@/lib/branch-options";

// How many car names fit in the second line of an option before it becomes "+N".
const PREVIEW_COUNT = 3;

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

// A branch list where each option also names a few of the cars waiting there, so the
// choice of branch is also a first look at what can be rented.
export function BranchSelect({ options, value, onChange, id, labelledBy, ref, ...aria }: BranchSelectProps) {
  const t = useTranslations("RentalSearch");

  function preview(option: BranchOption) {
    if (option.vehicleNames.length === 0) return t("noVehicles");
    const shown = option.vehicleNames.slice(0, PREVIEW_COUNT).join(", ");
    const more = option.vehicleNames.length - PREVIEW_COUNT;
    return more > 0 ? `${shown} ${t("andMore", { count: more })}` : shown;
  }

  return (
    <SelectMenu value={value || undefined} onValueChange={onChange}>
      <SelectMenuTrigger
        ref={ref}
        id={id}
        aria-labelledby={labelledBy}
        className="data-placeholder:text-fg-subtle"
        {...aria}
      >
        <SelectMenuValue placeholder={t("branchPlaceholder")} />
      </SelectMenuTrigger>
      <SelectMenuContent>
        {options.map((option) => (
          <SelectMenuItem key={option.id} value={option.id} description={preview(option)}>
            {option.label}
          </SelectMenuItem>
        ))}
      </SelectMenuContent>
    </SelectMenu>
  );
}
