import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { Link } from "@/i18n/navigation";
import { toBookingQuery } from "@/lib/booking";
import { loadBooking } from "@/lib/booking-data";
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
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();
  const loaded = await loadBooking(await searchParams, currency);

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
  if (loaded.status === "error") {
    return shell(
      <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
        <Button asChild>
          <Link href={{ pathname: "/rezervasyon", query: toBookingQuery(loaded.booking) }}>{t("error.retry")}</Link>
        </Button>
      </StateMessage>,
    );
  }

  const { booking, vehicle, pickup, dropoff, extras: chosen, days, summary, query } = loaded;
  // The car page names the car in its path, so it takes the search and the extras only.
  const detailQuery = {
    ...toQuery(booking.search),
    ...(chosen.length ? { ek: chosen.map((extra) => extra.slug).join(",") } : {}),
  };

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
            <Button asChild variant="link" className="self-start px-0">
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
              </p>
            </div>
            <Button asChild variant="link" className="self-start px-0">
              <Link href={{ pathname: "/araclar", query: toQuery(booking.search) }}>{t("changeVehicle")}</Link>
            </Button>
          </section>

          <section aria-labelledby="extras-summary-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <h2 id="extras-summary-title" className="text-h3 text-fg">
              {t("extrasTitle")}
            </h2>
            {chosen.length === 0 ? (
              <p className="text-body text-fg-muted">{t("noExtras")}</p>
            ) : (
              <ul className="list-disc pl-5 text-body text-fg">
                {chosen.map((extra) => (
                  <li key={extra.slug}>{extra.name[locale]}</li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="self-start px-0">
              <Link href={{ pathname: "/araclar/[slug]", params: { slug: vehicle.slug }, query: detailQuery }}>
                {t("changeExtras")}
              </Link>
            </Button>
          </section>
        </div>

        <section
          aria-labelledby="price-title"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface-muted p-6 xl:sticky xl:top-24"
        >
          <h2 id="price-title" className="text-h3 text-fg">
            {t("priceTitle")}
          </h2>
          <dl className="flex flex-col gap-2 text-body text-fg">
            <div className="flex justify-between gap-4">
              <dt>
                {t("vehicleLine", {
                  brand: vehicle.brand,
                  model: vehicle.model,
                  price: money(vehicle.dailyPrice),
                  days,
                })}
              </dt>
              <dd className="tabular-nums">{money(summary.vehicleTotal)}</dd>
            </div>
            {summary.extraLines.map(({ extra, cost }) => (
              <div key={extra.slug} className="flex justify-between gap-4">
                <dt>{extra.name[locale]}</dt>
                <dd className="tabular-nums">{money(cost)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-border-strong pt-3 text-h3">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{money(summary.total)}</dd>
            </div>
          </dl>
          <p className="text-small text-fg-muted">{t("noHidden")}</p>
          <GuaranteeStrip />
          <p className="text-small text-fg-muted">{t("payNote")}</p>
          <Button asChild size="lg">
            <Link href={{ pathname: "/odeme", query }}>{t("continue")}</Link>
          </Button>
        </section>
      </div>
    </>,
  );
}
