import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { BookingData } from "@/lib/booking-data";
import { PriceLines } from "./price-lines";
import { localToInstant } from "@/lib/rental-search";

// The short version of the booking (car, where and when, extras, total), shown beside the
// payment form and on the confirmation. Lines are the same ones as on the summary page.
export async function BookingBrief({ data, title }: { data: BookingData; title: string }) {
  const t = await getTranslations("BookingSummary");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const { vehicle, pickup, dropoff, days, summary } = data;

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
      <div className="flex flex-col gap-2 border-t border-border-strong pt-4">
        <PriceLines vehicle={vehicle} days={days} summary={summary} />
      </div>
    </section>
  );
}
