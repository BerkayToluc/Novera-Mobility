import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { POINT_VALUE } from "@/lib/points";
import { VAT_PERCENT, type PriceSummary } from "@/lib/price-summary";
import { formatMoney } from "@/lib/price";
import type { Vehicle } from "@/lib/vehicle";

// The lines of a booking's price (SPEC §2.3), the same on the summary page, beside the payment
// form and on the confirmation: the car, the extras, a subtotal when something comes off, the
// campaign code, the points, the total, and how much of the total is VAT (it is inside the price,
// not on top of it). The lines come from the summary the server priced; nothing is added up here.
export async function PriceLines({
  vehicle,
  days,
  summary,
}: {
  vehicle: Pick<Vehicle, "brand" | "model" | "dailyPrice">;
  days: number;
  summary: PriceSummary;
}) {
  const t = await getTranslations("BookingSummary");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const money = (value: Parameters<typeof formatMoney>[1]) => formatMoney(format, value);
  const reduced = summary.discount !== null || summary.points !== null;

  return (
    <>
      <dl className="flex flex-col gap-2 text-body text-fg">
        <div className="flex justify-between gap-4">
          <dt>
            {t("vehicleLine", {
              brand: vehicle.brand,
              model: vehicle.model,
              price: money(vehicle.dailyPrice),
              days,
            })}
          </dt>
          <dd className="whitespace-nowrap tabular-nums">{money(summary.vehicleTotal)}</dd>
        </div>
        {summary.extraLines.map(({ extra, cost }) => (
          <div key={extra.slug} className="flex justify-between gap-4">
            <dt>{extra.name[locale]}</dt>
            <dd className="whitespace-nowrap tabular-nums">{money(cost)}</dd>
          </div>
        ))}
        {reduced && (
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt>{t("subtotal")}</dt>
            <dd className="whitespace-nowrap tabular-nums">{money(summary.subtotal)}</dd>
          </div>
        )}
        {summary.discount && (
          <div className="flex justify-between gap-4 text-success">
            <dt>{t("discount", { code: summary.discount.code, percent: summary.discount.percent })}</dt>
            <dd className="whitespace-nowrap tabular-nums">−{money(summary.discount.amount)}</dd>
          </div>
        )}
        {summary.points && (
          <div className="flex justify-between gap-4 text-success">
            <dt>{t("pointsLine", { count: format.number(summary.points.count), value: money(POINT_VALUE) })}</dt>
            <dd className="whitespace-nowrap tabular-nums">−{money(summary.points.amount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-border-strong pt-3 text-h3">
          <dt>{t("total")}</dt>
          <dd className="whitespace-nowrap tabular-nums">{money(summary.total)}</dd>
        </div>
      </dl>
      <p className="flex justify-between gap-4 text-small tabular-nums text-fg-muted">
        <span>{t("vatIncluded", { percent: VAT_PERCENT })}</span>
        <span className="whitespace-nowrap">{money(summary.vat)}</span>
      </p>
    </>
  );
}
