import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReservationList } from "@/components/profile/reservation-list";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { getMyReservations } from "@/lib/account-client";
import type { Reservation } from "@/lib/reservation";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("bookings"), robots: { index: false } };
}

export default async function BookingsPage() {
  const t = await getTranslations("Profile.bookings");
  const session = await getSession();
  if (!session) return null;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the segment's error boundary.
  let reservations: Reservation[] | null;
  try {
    reservations = await getMyReservations();
  } catch {
    reservations = null;
  }

  // The list could not be fetched: say so, with a way to try again, instead of a blank page.
  const content = reservations ? (
    <ReservationList reservations={reservations} />
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
