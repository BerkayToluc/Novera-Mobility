"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/i18n/navigation";
import type { Money } from "@/lib/currency";
import { extraCost, type Extra } from "@/lib/extra";
import { formatMoney } from "@/lib/price";

type ExtrasPickerProps = {
  vehicle: { slug: string; brand: string; model: string; dailyPrice: Money };
  extras: Extra[];
  // null until the visitor has chosen dates: only then can a total be worked out.
  days: number | null;
  // The search that led here, handed on to the booking page.
  searchQuery: Record<string, string> | null;
};

// The extras and the running price summary live together because the summary has to follow
// every tick of a checkbox. Prices are only added up here; the amount that is finally
// charged is the one the backend works out when the reservation is made.
export function ExtrasPicker({ vehicle, extras, days, searchQuery }: ExtrasPickerProps) {
  const t = useTranslations("VehicleDetail");
  const format = useFormatter();
  const locale = useLocale() as "tr" | "en";
  const [selected, setSelected] = useState<string[]>([]);

  const money = (value: Money) => formatMoney(format, value);
  const chosen = extras.filter((extra) => selected.includes(extra.slug));
  const { currency } = vehicle.dailyPrice;
  const vehicleTotal = days ? vehicle.dailyPrice.amount * days : 0;
  const total: Money = {
    amount: vehicleTotal + chosen.reduce((sum, extra) => sum + extraCost(extra, days ?? 1).amount, 0),
    currency,
  };

  function toggle(slug: string, on: boolean) {
    setSelected((current) => (on ? [...current, slug] : current.filter((item) => item !== slug)));
  }

  return (
    <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
      <section aria-labelledby="extras-title" className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 id="extras-title" className="text-h2 text-fg">
            {t("extrasTitle")}
          </h2>
          <p className="max-w-prose text-body text-fg-muted">{t("extrasIntro")}</p>
        </header>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface px-4">
          {extras.map((extra) => (
            <li key={extra.slug} className="flex flex-col justify-between gap-1 py-1 md:flex-row md:items-center md:gap-4">
              <Checkbox
                checked={selected.includes(extra.slug)}
                onChange={(event) => toggle(extra.slug, event.target.checked)}
              >
                {extra.name[locale]}
              </Checkbox>
              <span className="pl-8 text-small tabular-nums text-fg-muted md:pl-0">
                {t(extra.pricing === "PER_DAY" ? "perDay" : "fixed", { price: money(extra.price) })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="summary-title"
        className="flex flex-col gap-4 rounded-card border border-border bg-surface-muted p-6 xl:sticky xl:top-24"
      >
        <h2 id="summary-title" className="text-h3 text-fg">
          {t("summaryTitle")}
        </h2>

        {days === null ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-label text-fg">{t("needDates.title")}</p>
            <p className="text-body text-fg-muted">{t("needDates.text")}</p>
            <Button asChild variant="outline">
              <Link href="/">{t("needDates.action")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <dl className="flex flex-col gap-2 text-body text-fg">
              <div className="flex justify-between gap-4">
                <dt>{t("vehicleLine", { brand: vehicle.brand, model: vehicle.model, days })}</dt>
                <dd className="tabular-nums">{money({ amount: vehicleTotal, currency })}</dd>
              </div>
              {chosen.map((extra) => (
                <div key={extra.slug} className="flex justify-between gap-4">
                  <dt>{extra.name[locale]}</dt>
                  <dd className="tabular-nums">{money(extraCost(extra, days))}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-border-strong pt-3 text-h3">
                <dt>{t("total")}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
            <p className="text-small text-fg-muted">{t("noHidden")}</p>
            <Button asChild size="lg">
              <Link
                href={{
                  pathname: "/rezervasyon",
                  query: { ...searchQuery, arac: vehicle.slug, ...(selected.length ? { ek: selected.join(",") } : {}) },
                }}
              >
                {t("continue")}
              </Link>
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
