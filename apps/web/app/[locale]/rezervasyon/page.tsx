import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ExtrasSelect } from "@/components/booking/extras-select";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { HoldEnded } from "@/components/booking/hold-states";
import { PriceLines } from "@/components/booking/price-lines";
import { PromoCode } from "@/components/payment/promo-code";
import { TotalBar } from "@/components/booking/total-bar";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { PointsToggle } from "@/components/vehicle/points-toggle";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { Link } from "@/i18n/navigation";
import { toBookingQuery } from "@/lib/booking";
import { loadBooking } from "@/lib/booking-data";
import { currentTime } from "@/lib/clock";
import { getCurrency } from "@/lib/get-currency";
import { formatMoney } from "@/lib/price";
import { localToInstant, toQuery } from "@/lib/rental-search";
import type { Branch } from "@/lib/vehicle";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingSummary");
  // Built from a visitor's own choices; nothing here for a search engine.
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function BookingSummaryPage({ searchParams }: Props) {
  const t = await getTranslations("BookingSummary");
  const d = await getTranslations("Driver");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();
  const params = await searchParams;
  const loaded = await loadBooking(params, currency);

  const shell = (children: ReactNode) => (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">{children}</div>
  );

  if (loaded.status === "missing") {
    return shell(
      <StateMessage title={t("missing.title")} text={t("missing.text")}>
        <Button asChild>
          <Link href="/">{t("missing.action")}</Link>
        </Button>
      </StateMessage>,
    );
  }
  if (loaded.status === "expired") return shell(<HoldEnded booking={loaded.booking} reason="expired" />);
  // The payment page sends the visitor here when the car was taken while paying.
  if (params.durum === "dolu") return shell(<HoldEnded booking={loaded.booking} reason="taken" />);
  if (loaded.status === "error") {
    return shell(
      <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
        <Button asChild>
          <Link href={{ pathname: "/rezervasyon", query: toBookingQuery(loaded.booking) }}>{t("error.retry")}</Link>
        </Button>
      </StateMessage>,
    );
  }

  const { booking, vehicle, pickup, dropoff, extras: chosen, allExtras, days, summary, hold, query } = loaded;

  const money = (value: Parameters<typeof formatMoney>[1]) => formatMoney(format, value);
  const moment = (local: string) =>
    format.dateTime(localToInstant(local), { dateStyle: "medium", timeStyle: "short" });
  const place = (branch: Branch) => `${branch.city} · ${branch.name}`;

  return shell(
    <>
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {hold && <HoldCountdown expiresAt={hold.expiresAt} serverNow={new Date(currentTime()).toISOString()} />}

      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="trip-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <h2 id="trip-title" className="text-h3 text-fg">
              {t("tripTitle")}
            </h2>
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-small text-fg-muted">{t("pickup")}</dt>
                <dd className="text-body text-fg">{place(pickup)}</dd>
                <dd className="text-body tabular-nums text-fg-muted">{moment(booking.search.startAt)}</dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("dropoff")}</dt>
                <dd className="text-body text-fg">{place(dropoff)}</dd>
                <dd className="text-body tabular-nums text-fg-muted">{moment(booking.search.endAt)}</dd>
              </div>
              <div>
                <dt className="text-small text-fg-muted">{t("duration")}</dt>
                <dd className="text-body text-fg">{t("days", { days })}</dd>
              </div>
            </dl>
            <Button asChild variant="link" size="inline" className="self-start">
              <Link href={{ pathname: "/araclar", query: toQuery(booking.search) }}>{t("changeTrip")}</Link>
            </Button>
          </section>

          <section aria-labelledby="vehicle-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <h2 id="vehicle-title" className="text-h3 text-fg">
              {t("vehicleTitle")}
            </h2>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="md:w-60 md:shrink-0">
                <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} />
              </div>
              <p className="text-body text-fg">
                <span className="text-h3">
                  {vehicle.brand} {vehicle.model}
                </span>
                <br />
                <span className="text-fg-muted">{vehicle.vehicleClass.name[locale]}</span>
                <br />
                <span className="text-small text-fg-muted">
                  {d("requirementNote")}
                </span>
              </p>
            </div>
            <Button asChild variant="link" size="inline" className="self-start">
              <Link href={{ pathname: "/araclar", query: toQuery(booking.search) }}>{t("changeVehicle")}</Link>
            </Button>
          </section>

          <section aria-labelledby="extras-summary-title" className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h2 id="extras-summary-title" className="text-h3 text-fg">
                {t("extrasTitle")}
              </h2>
              <p className="max-w-prose text-body text-fg-muted">{t("extras.intro")}</p>
            </header>
            <ExtrasSelect extras={allExtras} selected={chosen.map((extra) => extra.slug)} query={query} />
          </section>

          <GuaranteeStrip />
        </div>

        <section
          aria-labelledby="price-title"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface-muted p-6 xl:sticky xl:top-24"
        >
          <h2 id="price-title" className="text-h3 text-fg">
            {t("priceTitle")}
          </h2>
          <PriceLines vehicle={vehicle} days={days} summary={summary} />
          {loaded.pointsBalance !== null && (
            <PointsToggle balance={loaded.pointsBalance} on={booking.usePoints === true} pathname="/rezervasyon" />
          )}
          <PromoCode
            query={query}
            promo={loaded.promo}
            percent={summary.discount?.percent ?? null}
            pathname="/rezervasyon"
            problem={params.kodhata === "dolu" ? "exhausted" : params.kodhata === "kullanildi" ? "used" : undefined}
          />
          <p className="text-small text-fg-muted">{t("vatNote")}</p>
          <p className="text-small text-fg">
            {t.rich("cancelNote", {
              link: (chunks) => (
                <Link href="/kiralama-kosullari" className="text-link underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p className="text-small text-fg-muted">{t("noHidden")}</p>
          <p className="text-small text-fg-muted">{t("payNote")}</p>
          <Button asChild size="lg" className="max-xl:hidden">
            <Link href={{ pathname: "/odeme", query }}>{t("continue")}</Link>
          </Button>
        </section>
      </div>

      <TotalBar label={t("total")} amount={money(summary.total)}>
        <Button asChild size="lg">
          <Link href={{ pathname: "/odeme", query }}>{t("continue")}</Link>
        </Button>
      </TotalBar>
    </>,
  );
}
