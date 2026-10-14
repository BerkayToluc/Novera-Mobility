"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  activeFilterCount,
  NO_FILTERS,
  SEAT_STEPS,
  SORTS,
  toFilterQuery,
  type VehicleFilters,
} from "@/lib/vehicle-filters";
import type { FuelType, Transmission } from "@/lib/vehicle";

const TRANSMISSIONS: Transmission[] = ["AUTOMATIC", "MANUAL"];
const FUELS: FuelType[] = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"];
const FILTER_KEYS = ["sinif", "vites", "yakit", "koltuk", "sirala"];

// The filter button beside the result count (SPEC §2.3): a panel with the car class, gearbox, fuel,
// seats and the order. A choice applies at once and is kept in the address next to the search (the
// router replaces the page's own entry, so Back does not step through every tap). A chip pressed
// again clears its group. The list of classes is what the search actually found, not every class.
export function ResultsFilter({
  filters,
  classOptions,
}: {
  filters: VehicleFilters;
  classOptions: { slug: string; name: string }[];
}) {
  const t = useTranslations("ResultsPage.filters");
  const v = useTranslations("Vehicle");
  const locale = useLocale();
  const router = useRouter();
  const current = useSearchParams();
  const count = activeFilterCount(filters);

  function apply(next: VehicleFilters) {
    // Everything else in the address (the search, the points choice) stays as it is.
    const query: Record<string, string> = {};
    current.forEach((value, key) => {
      if (!FILTER_KEYS.includes(key)) query[key] = value;
    });
    router.replace({ pathname: "/araclar", query: { ...query, ...toFilterQuery(next) } }, { scroll: false });
  }

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-label transition-colors",
      active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {t("button")}
          {count > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-small text-on-primary">
              {count}
              <span className="sr-only"> {t("active", { count })}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] overflow-y-auto p-5" aria-label={t("title")}>
        <div className="flex flex-col gap-5">
          <Group label={t("class")}>
            {classOptions.map((option) => (
              <button
                key={option.slug}
                type="button"
                aria-pressed={filters.classSlug === option.slug}
                onClick={() => apply({ ...filters, classSlug: filters.classSlug === option.slug ? null : option.slug })}
                className={chip(filters.classSlug === option.slug)}
              >
                {option.name}
              </button>
            ))}
          </Group>
          <Group label={t("transmission")}>
            {TRANSMISSIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.transmission === value}
                onClick={() => apply({ ...filters, transmission: filters.transmission === value ? null : value })}
                className={chip(filters.transmission === value)}
              >
                {v(`transmission.${value}`)}
              </button>
            ))}
          </Group>
          <Group label={t("fuel")}>
            {FUELS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.fuel === value}
                onClick={() => apply({ ...filters, fuel: filters.fuel === value ? null : value })}
                className={chip(filters.fuel === value)}
              >
                {v(`fuel.${value}`)}
              </button>
            ))}
          </Group>
          <Group label={t("seats")}>
            {SEAT_STEPS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.minSeats === value}
                onClick={() => apply({ ...filters, minSeats: filters.minSeats === value ? null : value })}
                className={chip(filters.minSeats === value)}
              >
                {t("seatsAtLeast", { count: value })}
              </button>
            ))}
          </Group>
          <Group label={t("sort")}>
            {SORTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.sort === value}
                onClick={() => apply({ ...filters, sort: value })}
                className={chip(filters.sort === value)}
              >
                {t(`sorts.${value}`)}
              </button>
            ))}
          </Group>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            disabled={count === 0 && filters.sort === NO_FILTERS.sort}
            onClick={() => apply(NO_FILTERS)}
            lang={locale}
          >
            {t("clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p aria-hidden="true" className="text-label text-fg">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
