import type { Metadata } from "next";
import { Cog, Fuel, Luggage, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { ExtrasPicker } from "@/components/vehicle/extras-picker";
import { GuaranteeStrip } from "@/components/vehicle/guarantee-strip";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { Link } from "@/i18n/navigation";
import type { Extra } from "@/lib/extra";
import { getExtras, getVehicle } from "@/lib/fleet-client";
import { getCurrency } from "@/lib/get-currency";
import { formatMoney } from "@/lib/price";
import { parseRentalSearch, rentalDays, toQuery } from "@/lib/rental-search";
import type { Vehicle } from "@/lib/vehicle";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const currency = await getCurrency();
  try {
    const vehicle = await getVehicle(slug, currency);
    if (vehicle) return { title: `${vehicle.brand} ${vehicle.model}`, robots: { index: false } };
  } catch {
    // The page itself shows the failure; the title just falls back to the site's.
  }
  return {};
}

export default async function VehicleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const t = await getTranslations("VehicleDetail");
  const v = await getTranslations("Vehicle");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();
  const search = parseRentalSearch(await searchParams);

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the error boundary.
  let vehicle: Vehicle | null;
  let extras: Extra[];
  try {
    [vehicle, extras] = await Promise.all([getVehicle(slug, currency), getExtras(currency)]);
  } catch {
    return (
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-16">
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href={{ pathname: "/araclar/[slug]", params: { slug } }}>{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      </div>
    );
  }
  if (!vehicle) notFound();

  const specs = [
    { icon: Users, label: v("seats", { count: vehicle.seats }) },
    { icon: Luggage, label: v("bags", { count: vehicle.bags }) },
    { icon: Cog, label: v(`transmission.${vehicle.transmission}`) },
    { icon: Fuel, label: v(`fuel.${vehicle.fuelType}`) },
  ];
  const query = search ? toQuery(search) : null;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
      <Button asChild variant="link" className="self-start px-0">
        {query ? (
          <Link href={{ pathname: "/araclar", query }}>{t("back")}</Link>
        ) : (
          <Link href="/">{t("backToSearch")}</Link>
        )}
      </Button>

      <div className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-center">
        <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} />
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-h1 text-fg">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="text-body text-fg-muted">
              {vehicle.vehicleClass.name[locale]} · {t("year", { year: vehicle.year })}
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-3 text-body text-fg-muted">
            {specs.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          <p className="text-h2 tabular-nums text-fg">
            {v("perDay", { price: formatMoney(format, vehicle.dailyPrice) })}
          </p>
        </div>
      </div>

      <GuaranteeStrip />

      <ExtrasPicker
        vehicle={vehicle}
        extras={extras}
        days={search ? rentalDays(search) : null}
        searchQuery={query}
      />
    </div>
  );
}
