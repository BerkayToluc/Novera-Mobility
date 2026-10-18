import type { Metadata } from "next";
import { CheckCircle2, Coins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BookingBrief } from "@/components/booking/booking-brief";
import { ReservationBrief } from "@/components/booking/reservation-brief";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { Link } from "@/i18n/navigation";
import { fetchMyReceipt } from "@/lib/api-account";
import type { Receipt } from "@/lib/api-mappers";
import { loadBooking } from "@/lib/booking-data";
import { getCurrency } from "@/lib/get-currency";
import { pointsForTotal } from "@/lib/points";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Confirmation");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Booking numbers look like NVR-2026-00123.
const NUMBER = /^NVR-\d{4}-\d{5}$/;

// The reservation is read back by its number: from `GET /me/reservations`, so the page does not depend on
// the address or on the car still being free (the booking has taken it). With USE_MOCKS=1 there is no API
// to read it from, so it is rebuilt from the address, as before.
export default async function ConfirmationPage({ searchParams }: Props) {
  const t = await getTranslations("Confirmation");
  const params = await searchParams;
  const number = typeof params.no === "string" && NUMBER.test(params.no) ? params.no : null;
  const mocks = process.env.USE_MOCKS === "1";

  let receipt: Receipt | null = null;
  let failed = false;
  if (number && !mocks) {
    try {
      receipt = await fetchMyReceipt(number);
    } catch {
      failed = true;
    }
  }
  const loaded = number && mocks ? await loadBooking(params, await getCurrency(), { hold: "ignore" }) : null;

  if (failed) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-16">
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/profil/rezervasyonlar">{t("bookings")}</Link>
          </Button>
        </StateMessage>
      </div>
    );
  }
  if (!number || (mocks ? loaded?.status !== "ok" : receipt === null)) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-16">
        <StateMessage title={t("missing.title")} text={t("missing.text")}>
          <Button asChild>
            <Link href="/">{t("missing.action")}</Link>
          </Button>
        </StateMessage>
      </div>
    );
  }

  // Points follow the lira total, so with the sample data it is worked out in lira whatever currency the
  // page shows; the API says how many the reservation earned.
  let points = receipt?.pointsEarned ?? 0;
  if (mocks && (await getSession())?.type === "individual") {
    const inLira = await loadBooking(params, "TRY", { hold: "ignore" });
    if (inLira.status === "ok") points = pointsForTotal(inLira.summary.total);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-12 md:px-8 xl:py-16">
      {/* A single short column, centred: the page ends a flow, so it reads as a receipt, not a form. */}
      <header className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("text")}</p>
        <p className="flex flex-col gap-1">
          <span className="text-small text-fg-muted">{t("number")}</span>
          <span className="text-h2 tabular-nums text-fg">{number}</span>
        </p>
        {points > 0 && (
          <p className="flex items-center gap-2 text-body text-fg">
            <Coins aria-hidden="true" className="size-5 text-link" />
            {t("points", { count: points })}
          </p>
        )}
      </header>

      <div className="flex w-full max-w-xl flex-col gap-4">
        {receipt ? (
          <ReservationBrief receipt={receipt} title={t("rentalTitle")} />
        ) : (
          loaded?.status === "ok" && <BookingBrief data={loaded} title={t("rentalTitle")} />
        )}
        <GuaranteeStrip />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/profil/rezervasyonlar">{t("bookings")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
