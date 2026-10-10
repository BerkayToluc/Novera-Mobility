import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BookingBrief } from "@/components/booking/booking-brief";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { Link } from "@/i18n/navigation";
import { loadBooking } from "@/lib/booking-data";
import { getCurrency } from "@/lib/get-currency";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Confirmation");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Booking numbers look like NVR-2026-00123.
const NUMBER = /^NVR-\d{4}-\d{5}$/;

// Until the API exists (BACKLOG #22) the booking is rebuilt from the URL; with it, this
// page reads the reservation by its number and the other parameters go away.
export default async function ConfirmationPage({ searchParams }: Props) {
  const t = await getTranslations("Confirmation");
  const params = await searchParams;
  const number = typeof params.no === "string" && NUMBER.test(params.no) ? params.no : null;
  const loaded = await loadBooking(params, await getCurrency());

  if (!number || loaded.status !== "ok") {
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

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
      <header className="flex flex-col gap-4">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("text")}</p>
        <p className="flex flex-col gap-1">
          <span className="text-small text-fg-muted">{t("number")}</span>
          <span className="text-h2 tabular-nums text-fg">{number}</span>
        </p>
      </header>

      <div className="flex max-w-xl flex-col gap-4">
        <BookingBrief data={loaded} title={t("rentalTitle")} />
        <GuaranteeStrip />
      </div>

      <div className="flex flex-wrap gap-3">
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
