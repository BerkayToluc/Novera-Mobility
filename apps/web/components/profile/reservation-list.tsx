import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { Reservation } from "@/lib/reservation";

export async function ReservationList({ reservations }: { reservations: Reservation[] }) {
  const t = await getTranslations("Profile.bookings");
  const format = await getFormatter();

  if (reservations.length === 0) {
    return (
      <StateMessage title={t("empty.title")} text={t("empty.text")}>
        <Button asChild size="lg">
          <Link href="/araclar">{t("empty.cta")}</Link>
        </Button>
      </StateMessage>
    );
  }

  const date = (value: string) =>
    format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <ul className="flex flex-col gap-4">
      {reservations.map((reservation) => {
        const cancelled = reservation.status === "CANCELLED";
        const sameCity = reservation.pickupCity === reservation.returnCity;
        return (
          <li key={reservation.id} className="rounded-card border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h3 text-fg">
                {reservation.vehicle.brand} {reservation.vehicle.model}
              </h2>
              {/* The status is written out, never colour alone (WCAG 1.4.1). */}
              <span
                className={`inline-flex rounded-full px-3 py-1 text-small ${
                  cancelled ? "bg-surface-muted text-fg-muted" : "bg-selected text-on-selected"
                }`}
              >
                {t(`status.${reservation.status}`)}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-body md:grid-cols-2">
              <div>
                <dt className="text-small text-fg-muted">{t("number")}</dt>
                <dd className="tabular-nums text-fg">{reservation.number}</dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("dates")}</dt>
                <dd className="text-fg">
                  {date(reservation.startAt)} – {date(reservation.endAt)} ·{" "}
                  {t("days", { count: reservation.days })}
                </dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("location")}</dt>
                <dd className="text-fg">
                  {sameCity ? reservation.pickupCity : `${reservation.pickupCity} → ${reservation.returnCity}`}
                </dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("total")}</dt>
                <dd className="tabular-nums text-fg">
                  {format.number(reservation.totalPrice / 100, {
                    style: "currency",
                    currency: "TRY",
                    maximumFractionDigits: 0,
                  })}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
