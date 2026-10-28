import { Coins, Navigation } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ContactLink } from "@/components/ui/contact-link";
import { StateMessage } from "@/components/ui/state-message";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { Link } from "@/i18n/navigation";
import { directionsUrl, type BranchDetail } from "@/lib/branch-detail";
import { formatMoney } from "@/lib/price";
import { cancelsForFree, reservationPhase, type Reservation, type ReservationPhase } from "@/lib/reservation";
import { CancelReservation } from "./cancel-reservation";

export type BookingsFilter = "all" | "upcoming" | "past" | "cancelled";

const PHASE_TONE: Record<ReservationPhase, string> = {
  UPCOMING: "bg-selected text-on-selected",
  ACTIVE: "bg-primary text-on-primary",
  COMPLETED: "bg-surface-muted text-fg-muted",
  CANCELLED: "bg-surface-muted text-fg-muted",
};

// The bookings, each a card (SPEC §2.9, v0.8): the car, where and when with the branch names and
// times, the total and the points, and the things to do: the way there, a call to the branch and,
// while it is still ahead, to cancel it. `now` comes from the caller so the list stays a pure
// function of its inputs; `branches` are looked up by id for the names, addresses and phones.
export async function ReservationList({
  reservations,
  now,
  branches,
  filter,
}: {
  reservations: Reservation[];
  now: number;
  branches: BranchDetail[];
  filter: BookingsFilter;
}) {
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

  const phaseOf = (reservation: Reservation) => reservationPhase(reservation, now);
  const ahead = (reservation: Reservation) => ["UPCOMING", "ACTIVE"].includes(phaseOf(reservation));
  const startOf = (reservation: Reservation) => new Date(reservation.startAt).getTime();

  // Soonest first for what is coming, most recent first for what is over.
  const upcoming = reservations.filter(ahead).sort((a, b) => startOf(a) - startOf(b));
  const past = reservations
    .filter((reservation) => phaseOf(reservation) === "COMPLETED")
    .sort((a, b) => startOf(b) - startOf(a));
  const cancelled = reservations
    .filter((reservation) => phaseOf(reservation) === "CANCELLED")
    .sort((a, b) => startOf(b) - startOf(a));

  const branch = (id: string) => branches.find((entry) => entry.id === id);
  // Local time at the branch, whatever the server's clock says (ADR-16).
  const moment = (value: string) =>
    format.dateTime(new Date(value), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });

  function card(reservation: Reservation) {
    const phase = phaseOf(reservation);
    const pickup = branch(reservation.pickupBranchId);
    const dropoff = branch(reservation.returnBranchId);
    const carName = `${reservation.vehicle.brand} ${reservation.vehicle.model}`;
    const place = (entry: BranchDetail | undefined, city: string) => (entry ? `${entry.city} · ${entry.name}` : city);

    return (
      <li key={reservation.id} className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 md:p-6">
        <div className="flex gap-4">
          <div className="w-28 shrink-0 md:w-40">
            <VehicleImage imageUrl={reservation.vehicle.imageUrl} brand={reservation.vehicle.brand} model={reservation.vehicle.model} decorative />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {/* The status is written out, never colour alone (WCAG 1.4.1). */}
            <span className={`inline-flex rounded-full px-3 py-1 text-small ${PHASE_TONE[phase]}`}>{t(`status.${phase}`)}</span>
            <h4 className="text-h3 text-fg">{carName}</h4>
            <p className="text-small tabular-nums text-fg-muted">
              {t("number")} {reservation.number}
            </p>
          </div>
        </div>

        <dl className="grid gap-4 text-body md:grid-cols-2">
          <div>
            <dt className="text-small text-fg-muted">{t("pickup")}</dt>
            <dd className="text-fg">{place(pickup, reservation.pickupCity)}</dd>
            <dd className="tabular-nums text-fg-muted">{moment(reservation.startAt)}</dd>
          </div>
          <div>
            <dt className="text-small text-fg-muted">{t("dropoff")}</dt>
            <dd className="text-fg">{place(dropoff, reservation.returnCity)}</dd>
            <dd className="tabular-nums text-fg-muted">{moment(reservation.endAt)}</dd>
          </div>
          <div>
            <dt className="text-small text-fg-muted">{t("duration")}</dt>
            <dd className="text-fg">{t("days", { count: reservation.days })}</dd>
          </div>
          <div>
            <dt className="text-small text-fg-muted">{t("total")}</dt>
            <dd className="tabular-nums text-fg">{formatMoney(format, reservation.totalPrice)}</dd>
          </div>
        </dl>

        {phase !== "CANCELLED" && reservation.pointsEarned > 0 && (
          <p className="flex items-center gap-2 border-t border-border pt-4 text-body text-fg">
            <Coins aria-hidden="true" className="size-5 text-link" />
            {t(ahead(reservation) ? "pointsPending" : "pointsEarned", { count: reservation.pointsEarned })}
          </p>
        )}

        {ahead(reservation) && pickup && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button asChild variant="outline">
              <a href={directionsUrl(pickup)} target="_blank" rel="noopener noreferrer">
                <Navigation aria-hidden="true" className="size-4" />
                {t("directions")}
                <span className="sr-only">
                  {" "}
                  {pickup.name} {t("newTab")}
                </span>
              </a>
            </Button>
            <ContactLink
              value={pickup.phone}
              label={t("callBranch")}
              className="min-h-11 rounded-control border border-border-strong px-4 text-label text-fg transition-colors hover:bg-selected"
            />
            {phase === "UPCOMING" && (
              <CancelReservation id={reservation.id} carName={carName} free={cancelsForFree(reservation, now)} />
            )}
          </div>
        )}
      </li>
    );
  }

  const section = (id: string, title: string, items: Reservation[], empty: { title: string; text: string }, cta?: boolean) => (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3 id={id} className="text-h2 text-fg">
        {title}
      </h3>
      {items.length === 0 ? (
        <StateMessage title={empty.title} text={empty.text}>
          {cta && (
            <Button asChild>
              <Link href={{ pathname: "/", hash: "kiralama" }}>{t("empty.cta")}</Link>
            </Button>
          )}
        </StateMessage>
      ) : (
        <ul className="flex flex-col gap-4">{items.map((reservation) => card(reservation))}</ul>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-10">
      {(filter === "all" || filter === "upcoming") &&
        section("bookings-upcoming", t("upcoming.title"), upcoming, {
          title: t("upcoming.empty.title"),
          text: t("upcoming.empty.text"),
        }, true)}
      {(filter === "all" || filter === "past") &&
        section("bookings-past", t("past.title"), past, { title: t("past.empty.title"), text: t("past.empty.text") })}
      {(filter === "all" || filter === "cancelled") &&
        (filter === "cancelled" || cancelled.length > 0) &&
        section("bookings-cancelled", t("cancelled.title"), cancelled, {
          title: t("cancelled.empty.title"),
          text: t("cancelled.empty.text"),
        })}
    </div>
  );
}
