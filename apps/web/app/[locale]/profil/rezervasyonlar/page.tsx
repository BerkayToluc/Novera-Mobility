import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingsFilterChips, parseBookingsFilter } from "@/components/profile/bookings-filter";
import { ReservationList } from "@/components/profile/reservation-list";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link, redirect } from "@/i18n/navigation";
import { getMyReservations } from "@/lib/account-server";
import type { BranchDetail } from "@/lib/branch-detail";
import { currentTime } from "@/lib/clock";
import { getBranchDetails } from "@/lib/fleet-client";
import type { Reservation } from "@/lib/reservation";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("bookings"), robots: { index: false } };
}

export default async function BookingsPage({ searchParams }: PageProps<"/[locale]/profil/rezervasyonlar">) {
  const t = await getTranslations("Profile.bookings");
  const session = await getSession();
  if (!session) return null;
  // Bookings belong to individual accounts; a corporate one asks for quotes instead.
  if (session.type !== "individual") redirect({ href: "/profil", locale: await getLocale() });

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the segment's error boundary.
  let reservations: Reservation[] | null;
  try {
    reservations = await getMyReservations();
  } catch {
    reservations = null;
  }

  // The branches give the names, the way there and the phones; without them the cards still show
  // the cities and just leave the actions out.
  let branches: BranchDetail[] = [];
  try {
    branches = await getBranchDetails();
  } catch {
    branches = [];
  }
  const filter = parseBookingsFilter((await searchParams).durum);

  // The list could not be fetched: say so, with a way to try again, instead of a blank page.
  const content = reservations ? (
    <div className="flex flex-col gap-6">
      {reservations.length > 0 && <BookingsFilterChips current={filter} />}
      <ReservationList reservations={reservations} now={currentTime()} branches={branches} filter={filter} />
    </div>
  ) : (
    <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
      <Button asChild>
        <Link href="/profil/rezervasyonlar">{t("error.retry")}</Link>
      </Button>
    </StateMessage>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 text-fg">{t("title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </div>
      {content}
    </section>
  );
}
