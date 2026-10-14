import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { BranchDetail } from "@/lib/branch-detail";
import { reservationPhase, type Reservation } from "@/lib/reservation";

// "Your next trip" at the top of the account page (SPEC §2.9, v0.8): the soonest booking still
// ahead, with how long to go; or an invitation to make the first one. `now` comes from the caller.
export async function NextTrip({
  reservations,
  now,
  branches,
}: {
  reservations: Reservation[];
  now: number;
  branches: BranchDetail[];
}) {
  const t = await getTranslations("Profile.nextTrip");
  const format = await getFormatter();

  const next = reservations
    .filter((reservation) => ["UPCOMING", "ACTIVE"].includes(reservationPhase(reservation, now)))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

  if (!next) {
    return (
      <section aria-labelledby="next-trip" className="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-6 md:p-8">
        <h2 id="next-trip" className="text-h3 text-fg">
          {t("none.title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("none.text")}</p>
        <Button asChild>
          <Link href={{ pathname: "/", hash: "kiralama" }}>{t("none.cta")}</Link>
        </Button>
      </section>
    );
  }

  const days = Math.max(0, Math.ceil((new Date(next.startAt).getTime() - now) / 86_400_000));
  const date = (value: string) => format.dateTime(new Date(value), { day: "numeric", month: "long", year: "numeric" });
  const sameCity = next.pickupCity === next.returnCity;
  // The branch the trip starts at, with its name and the time, when the branches are known.
  const pickup = branches.find((branch) => branch.id === next.pickupBranchId);
  const pickupTime = format.dateTime(new Date(next.startAt), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  return (
    <section
      aria-labelledby="next-trip"
      className="flex flex-col gap-5 rounded-card bg-linear-to-br from-selected to-surface p-6 md:flex-row md:items-center md:justify-between md:p-8"
    >
      <div className="flex flex-col gap-3">
        <p className="text-label text-link">{t("title")}</p>
        <h2 id="next-trip" className="text-h2 text-fg">
          {next.vehicle.brand} {next.vehicle.model}
        </h2>
        <ul className="flex flex-col gap-1.5 text-body text-fg-muted">
          <li className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            {date(next.startAt)} – {date(next.endAt)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {pickup ? t("pickupAt", { branch: `${pickup.city} · ${pickup.name}`, time: pickupTime }) : sameCity ? next.pickupCity : `${next.pickupCity} → ${next.returnCity}`}
          </li>
        </ul>
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        <p className="rounded-full bg-surface px-4 py-1.5 text-label text-fg">{t("daysLeft", { days })}</p>
        <Button asChild variant="outline">
          <Link href="/profil/rezervasyonlar">
            {t("viewAll")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
