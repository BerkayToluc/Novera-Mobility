import { Coins } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/price";
import type { Reservation } from "@/lib/reservation";

// A booking is "upcoming" until its return time has passed, as long as it was not cancelled
// (SPEC §2.9): the trips ahead of the visitor, set apart from what is already behind them.
function isUpcoming(reservation: Reservation, now: number) {
  return reservation.status === "CONFIRMED" && new Date(reservation.endAt).getTime() > now;
}

// `now` comes from the caller so the list stays a pure function of its inputs.
export async function ReservationList({ reservations, now }: { reservations: Reservation[]; now: number }) {
  const t = await getTranslations("Profile.bookings");
  const format = await getFormatter();

  if (reservations.length === 0) {
    return (
      <StateMessage title={t("empty.title")} text={t("empty.text")}>
        <Button asChild size="lg">
          <Link href={{ pathname: "/", hash: "kiralama" }}>{t("empty.cta")}</Link>
        </Button>
      </StateMessage>
    );
  }

  // Soonest first for what is coming, most recent first for what is over.
  const upcoming = reservations
    .filter((reservation) => isUpcoming(reservation, now))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = reservations
    .filter((reservation) => !isUpcoming(reservation, now))
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const date = (value: string) =>
    format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric" });

  function card(reservation: Reservation, ahead: boolean) {
    const cancelled = reservation.status === "CANCELLED";
    const sameCity = reservation.pickupCity === reservation.returnCity;
    return (
      <li key={reservation.id} className="rounded-card border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-h3 text-fg">
            {reservation.vehicle.brand} {reservation.vehicle.model}
          </h4>
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
              {date(reservation.startAt)} – {date(reservation.endAt)} · {t("days", { count: reservation.days })}
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
            <dd className="tabular-nums text-fg">{formatMoney(format, reservation.totalPrice)}</dd>
          </div>
        </dl>
        {!cancelled && reservation.pointsEarned > 0 && (
          <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-body text-fg">
            <Coins aria-hidden="true" className="size-5 text-link" />
            {t(ahead ? "pointsPending" : "pointsEarned", { count: reservation.pointsEarned })}
          </p>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="bookings-upcoming" className="flex flex-col gap-4">
        <h3 id="bookings-upcoming" className="text-h2 text-fg">
          {t("upcoming.title")}
        </h3>
        {upcoming.length === 0 ? (
          <StateMessage title={t("upcoming.empty.title")} text={t("upcoming.empty.text")}>
            <Button asChild>
              <Link href={{ pathname: "/", hash: "kiralama" }}>{t("empty.cta")}</Link>
            </Button>
          </StateMessage>
        ) : (
          <ul className="flex flex-col gap-4">{upcoming.map((reservation) => card(reservation, true))}</ul>
        )}
      </section>

      <section aria-labelledby="bookings-past" className="flex flex-col gap-4">
        <h3 id="bookings-past" className="text-h2 text-fg">
          {t("past.title")}
        </h3>
        {past.length === 0 ? (
          <StateMessage title={t("past.empty.title")} text={t("past.empty.text")} />
        ) : (
          <ul className="flex flex-col gap-4">{past.map((reservation) => card(reservation, false))}</ul>
        )}
      </section>
    </div>
  );
}
