import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingBrief } from "@/components/booking/booking-brief";
import { PaymentForm } from "@/components/payment/payment-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { Link, redirect } from "@/i18n/navigation";
import { toBookingQuery } from "@/lib/booking";
import { loadBooking } from "@/lib/booking-data";
import { getCurrency } from "@/lib/get-currency";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Payment");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function PaymentPage({ searchParams }: Props) {
  const t = await getTranslations("Payment");
  const b = await getTranslations("BookingSummary");
  const params = await searchParams;
  const loaded = await loadBooking(params, await getCurrency());

  // Signing in is asked for right before paying, and the booking comes back with the visitor
  // (SPEC §2.3). With mocks on there is no auth API to sign in with, so the page opens
  // for walking through the flow; a build without mocks always enforces it.
  if (loaded.status === "ok" && process.env.USE_MOCKS !== "1" && !(await getSession())) {
    redirect({ href: { pathname: "/giris", query: { sonra: "odeme", ...loaded.query } }, locale: await getLocale() });
  }

  const shell = (children: ReactNode) => (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">{children}</div>
  );

  if (loaded.status === "missing") {
    return shell(
      <StateMessage title={b("missing.title")} text={b("missing.text")}>
        <Button asChild>
          <Link href="/">{b("missing.action")}</Link>
        </Button>
      </StateMessage>,
    );
  }
  if (loaded.status === "error") {
    return shell(
      <StateMessage tone="error" title={b("error.title")} text={b("error.text")}>
        <Button asChild>
          <Link href={{ pathname: "/odeme", query: toBookingQuery(loaded.booking) }}>{b("error.retry")}</Link>
        </Button>
      </StateMessage>,
    );
  }

  return shell(
    <>
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <div className="flex flex-col gap-6">
          <div role="note" className="flex items-start gap-3 rounded-card border border-border-strong bg-accent-soft p-4 text-on-accent-soft">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-label">{t("demoTitle")}</p>
              <p className="text-body">{t("demoText")}</p>
              <p className="text-small">{t("demoHint")}</p>
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-6 md:p-8">
            <PaymentForm query={loaded.query} />
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24">
          <BookingBrief data={loaded} title={t("summaryTitle")} />
          <GuaranteeStrip />
          <Button asChild variant="link" className="self-start px-0">
            <Link href={{ pathname: "/rezervasyon", query: loaded.query }}>{t("edit")}</Link>
          </Button>
        </div>
      </div>
    </>,
  );
}
