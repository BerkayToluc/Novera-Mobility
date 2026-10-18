import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { Receipt } from "@/lib/api-mappers";
import { PriceLines } from "./price-lines";

// The confirmation's version of the booking when the reservation was read back from the API
// (`GET /me/reservations`): the car, where and when, and the price as the API stored it. The
// payment page's BookingBrief is built from the address before the booking exists; this one from the booking.
export async function ReservationBrief({ receipt, title }: { receipt: Receipt; title: string }) {
  const t = await getTranslations("BookingSummary");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const moment = (instant: string) => format.dateTime(new Date(instant), { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-card border border-border bg-surface-muted p-6">
      <h2 className="text-h3 text-fg">{title}</h2>
      <p className="text-body text-fg">
        {receipt.vehicle.brand} {receipt.vehicle.model}
        <span className="text-fg-muted"> · {receipt.className[locale]}</span>
      </p>
      <dl className="flex flex-col gap-2 text-body">
        <div>
          <dt className="text-small text-fg-muted">{t("pickup")}</dt>
          <dd className="text-fg">
            {receipt.pickup.city} · {receipt.pickup.name}
          </dd>
          <dd className="tabular-nums text-fg-muted">{moment(receipt.startAt)}</dd>
        </div>
        <div>
          <dt className="text-small text-fg-muted">{t("dropoff")}</dt>
          <dd className="text-fg">
            {receipt.dropoff.city} · {receipt.dropoff.name}
          </dd>
          <dd className="tabular-nums text-fg-muted">{moment(receipt.endAt)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 border-t border-border-strong pt-4">
        <PriceLines vehicle={receipt.vehicle} days={receipt.days} summary={receipt.summary} />
      </div>
    </section>
  );
}
