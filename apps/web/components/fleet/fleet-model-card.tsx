"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { cn } from "@/lib/cn";
import type { FleetModel } from "@/lib/fleet-models";
import { moneyParts } from "@/lib/price";
import { useSpecs } from "./vehicle-specs";

// A horizontal card, one per row (SPEC §2.4): photo, facts, a price block and an arrow. On a phone
// the price block drops under the photo and facts. The whole card is one target: the name is the
// button, and its ::after stretches over the card. The name sits in a heading (a heading cannot
// sit inside a button), the facts stay plain text.
export function FleetModelCard({
  model,
  className,
  onOpen,
}: {
  model: FleetModel;
  className?: string;
  onOpen: () => void;
}) {
  const t = useTranslations("FleetPage");
  const v = useTranslations("Vehicle");
  const locale = useLocale();
  const specs = useSpecs(model);

  return (
    <article
      className={cn(
        "group relative grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-card border border-border bg-surface p-3 transition-colors md:grid-cols-[14rem_minmax(0,1fr)_auto_auto] md:gap-x-6 md:p-4 xl:grid-cols-[16rem_minmax(0,1fr)_auto_auto]",
        "hover:border-primary hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
        className,
      )}
    >
      <VehicleImage imageUrl={model.imageUrl} brand={model.brand} model={model.model} decorative />

      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="text-h3 text-fg">
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {model.brand} {model.model}
            <span className="sr-only">, {t("card.details")}</span>
          </button>
        </h3>
        {/* On a phone the first two facts: the rest is in the dialog. */}
        <ul className="flex flex-wrap gap-1.5">
          {specs.map(({ key, icon: Icon, label }, index) => (
            <li
              key={key}
              className={cn(
                "items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-small text-fg-muted group-hover:bg-surface",
                index < 2 ? "inline-flex" : "hidden md:inline-flex",
              )}
            >
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Under the photo on a phone (a row of its own); from md the two are cells of the card's grid. */}
      <div className="col-span-2 flex items-end justify-between gap-4 border-t border-border pt-3 md:contents">
        <div className="flex flex-col md:items-end md:border-l md:border-border md:pl-6 md:text-right">
          <span className="text-small text-fg-muted">{v("priceFrom")}</span>
          <p className="flex items-baseline gap-1 tabular-nums text-fg">
            <span className="flex items-baseline">
              {moneyParts(locale, model.fromPrice).map((part, index) => (
                // The sign sits small and high, the figure is the thing to read.
                <span key={index} className={part.type === "currency" ? "mr-0.5 text-label text-fg-muted" : "text-h2"}>
                  {part.value}
                </span>
              ))}
            </span>
            <span className="text-small text-fg-muted">{v("perDayUnit")}</span>
          </p>
        </div>

        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-link transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-on-primary"
        >
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
