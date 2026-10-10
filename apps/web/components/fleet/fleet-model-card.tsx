"use client";

import { ArrowRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { cn } from "@/lib/cn";
import type { FleetModel } from "@/lib/fleet-models";
import { formatMoney } from "@/lib/price";
import { useSpecs } from "./vehicle-specs";

// A horizontal card (SPEC §2.4): photo left, facts right, an arrow at the far end. The whole
// card is one target: the name is the button, and its ::after stretches over the card. The
// name sits in a heading (a heading cannot sit inside a button), the facts stay plain text.
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
  const format = useFormatter();
  const specs = useSpecs(model);

  return (
    <article
      className={cn(
        "group relative flex items-center gap-4 rounded-card border border-border bg-surface p-3 transition-colors md:gap-6 md:p-4",
        "hover:border-primary hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
        className,
      )}
    >
      <div className="w-28 shrink-0 md:w-56">
        <VehicleImage imageUrl={model.imageUrl} brand={model.brand} model={model.model} decorative />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
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
        <p className="text-label tabular-nums text-fg md:text-body md:font-semibold">
          {v("fromPerDay", { price: formatMoney(format, model.fromPrice) })}
        </p>
      </div>

      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-link transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-on-primary"
      >
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </article>
  );
}
