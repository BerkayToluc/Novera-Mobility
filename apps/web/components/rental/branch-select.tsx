"use client";

import { useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import {
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
} from "@/components/ui/select-menu";
import type { BranchOption } from "@/lib/branch-options";
import { useOpeningLabel } from "@/lib/use-opening-label";

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
  const label = useOpeningLabel();
  const [now, setNow] = useState(() => new Date());

  function status(option: BranchOption) {
    return label(option.openingHours, now).text;
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
