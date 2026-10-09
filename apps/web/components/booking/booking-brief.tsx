import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { BookingData } from "@/lib/booking-data";
import { formatMoney } from "@/lib/price";
import { localToInstant } from "@/lib/rental-search";

// The short version of the booking (car, where and when, extras, total), shown beside the
// payment form and on the confirmation. Lines are the same ones as on the summary page.
export async function BookingBrief({ data, title }: { data: BookingData; title: string }) {
  const t = await getTranslations("BookingSummary");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const { vehicle, pickup, dropoff, days, summary } = data;

  const money = (value: Parameters<typeof formatMoney>[1]) => formatMoney(format, value);
  const moment = (local: string) =>
    format.dateTime(localToInstant(local), { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-card border border-border bg-surface-muted p-6">
      <h2 className="text-h3 text-fg">{title}</h2>
      <p className="text-body text-fg">
        {vehicle.brand} {vehicle.model}
        <span className="text-fg-muted"> · {vehicle.vehicleClass.name[locale]}</span>
      </p>
      <dl className="flex flex-col gap-2 text-body">
        <div>
          <dt className="text-small text-fg-muted">{t("pickup")}</dt>
          <dd className="text-fg">
            {pickup.city} · {pickup.name}
          </dd>
          <dd className="tabular-nums text-fg-muted">{moment(data.booking.search.startAt)}</dd>
        </div>
        <div>
          <dt className="text-small text-fg-muted">{t("dropoff")}</dt>
          <dd className="text-fg">
            {dropoff.city} · {dropoff.name}
          </dd>
          <dd className="tabular-nums text-fg-muted">{moment(data.booking.search.endAt)}</dd>
        </div>
      </dl>
      <dl className="flex flex-col gap-2 border-t border-border-strong pt-4 text-body text-fg">
        <div className="flex justify-between gap-4">
          <dt>
            {t("vehicleLine", {
              brand: vehicle.brand,
              model: vehicle.model,
              price: money(vehicle.dailyPrice),
              days,
            })}
          </dt>
          <dd className="tabular-nums">{money(summary.vehicleTotal)}</dd>
        </div>
        {summary.extraLines.map(({ extra, cost }) => (
          <div key={extra.slug} className="flex justify-between gap-4">
            <dt>{extra.name[locale]}</dt>
            <dd className="tabular-nums">{money(cost)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border-strong pt-3 text-h3">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">{money(summary.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
