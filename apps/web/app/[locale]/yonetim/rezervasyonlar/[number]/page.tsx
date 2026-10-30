import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ReservationActions } from "@/components/admin/reservation-actions";
import { StatusChip } from "@/components/admin/status-chip";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { adminPhase, type AdminReservationDetail } from "@/lib/admin-reservations";
import { getAdminReservation } from "@/lib/admin-server";
import { currentTime } from "@/lib/clock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.reservations");
  return { title: t("detailTitle") };
}

export default async function ReservationPage({ params }: PageProps<"/[locale]/yonetim/rezervasyonlar/[number]">) {
  const t = await getTranslations("Admin.reservations");
  const locale = await getLocale();
  const { number } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still
  // reach the segment's error boundary. A booking that does not exist is a page that does not exist.
  let reservation: AdminReservationDetail | null;
  let failed = false;
  try {
    reservation = await getAdminReservation(number);
  } catch {
    reservation = null;
    failed = true;
  }
  if (!reservation && !failed) notFound();

  if (!reservation) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/rezervasyonlar/[number]", params: { number } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100);
  const phase = adminPhase(reservation, currentTime());
  const label = (value: { tr: string; en: string }) => (locale === "tr" ? value.tr : value.en);
  const facts: Array<[string, string]> = [
    [t("facts.start"), dateTime.format(new Date(reservation.startAt))],
    [t("facts.end"), dateTime.format(new Date(reservation.endAt))],
    [t("facts.days"), String(reservation.days)],
    [t("facts.created"), dateTime.format(new Date(reservation.createdAt))],
    [t("facts.pickup"), `${reservation.pickupBranch.name} (${reservation.pickupBranch.city})`],
    [t("facts.return"), `${reservation.returnBranch.name} (${reservation.returnBranch.city})`],
    [t("facts.vehicle"), `${reservation.vehicle.brand} ${reservation.vehicle.model}, ${reservation.vehicle.plate}`],
    [
      t("facts.customer"),
      reservation.customer
        ? `${reservation.customer.name}, ${reservation.customer.email}${reservation.customerAccount?.companyName ? `, ${reservation.customerAccount.companyName}` : ""}`
        : t("noCustomer"),
    ],
  ];

  return (
    <>
      <PageHeader
        title={reservation.number}
        description={t("detailIntro", { vehicle: `${reservation.vehicle.brand} ${reservation.vehicle.model}` })}
        action={<StatusChip tone={phase === "UPCOMING" || phase === "ACTIVE" ? "success" : "neutral"}>{t(`phase.${phase}`)}</StatusChip>}
      />

      <section aria-labelledby="reservation-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="reservation-facts" className="text-h3 text-fg">
          {t("facts.title")}
        </h2>
        <dl className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-small text-fg-muted">{term}</dt>
              <dd className="text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="reservation-price" className="flex max-w-2xl flex-col gap-3">
        <h2 id="reservation-price" className="text-h3 text-fg">
          {t("price.title")}
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {reservation.price.lines.map((line) => (
            <li key={`${line.type}-${line.slug}`} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
              <span className="text-body text-fg">
                {label(line.label)}
                {line.type !== "DISCOUNT" && <span className="text-fg-muted">{` × ${line.quantity}`}</span>}
              </span>
              <span className="text-body tabular-nums text-fg">{money(line.total.amount, line.total.currency)}</span>
            </li>
          ))}
          <li className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <span className="text-label text-fg">{t("price.total")}</span>
            <span className="text-label tabular-nums text-fg">{money(reservation.price.total.amount, reservation.price.total.currency)}</span>
          </li>
          {reservation.price.pointsUsed > 0 && (
            <li className="flex flex-wrap items-baseline justify-between gap-2 p-4">
              <span className="text-body text-fg">{t("price.pointsUsed", { points: reservation.price.pointsUsed })}</span>
              <span className="text-body tabular-nums text-fg">{t("price.payable", { amount: money(reservation.price.payable.amount, reservation.price.payable.currency) })}</span>
            </li>
          )}
        </ul>
        <p className="text-small text-fg-muted">
          {reservation.price.promo ? t("price.promo", { code: reservation.price.promo.code }) : t("price.noPromo")} {t("price.points", { points: reservation.pointsEarned })}
        </p>
      </section>

      {reservation.cancellation && (
        <section aria-labelledby="reservation-cancellation" className="flex max-w-2xl flex-col gap-2 rounded-card border border-border p-4">
          <h2 id="reservation-cancellation" className="text-h3 text-fg">
            {t("cancellation.title")}
          </h2>
          <p className="text-body text-fg">{t("cancellation.at", { at: dateTime.format(new Date(reservation.cancellation.at)) })}</p>
          <p className="text-body text-fg">
            {reservation.cancellation.by ? t("cancellation.by", { name: reservation.cancellation.by.name }) : t("cancellation.byCustomer")}
          </p>
          {reservation.cancellation.reason && <p className="text-body text-fg">{t("cancellation.reason", { reason: reservation.cancellation.reason })}</p>}
        </section>
      )}

      <ReservationActions reservation={reservation} />
    </>
  );
}
