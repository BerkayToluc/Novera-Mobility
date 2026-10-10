import type { ComponentProps, ReactNode } from "react";
import { Cog, Fuel, Luggage, Users } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Money } from "@/lib/currency";
import { formatMoney } from "@/lib/price";
import type { Vehicle, VehicleOffer } from "@/lib/vehicle";
import { VehicleImage } from "./vehicle-image";

type VehicleCardProps = {
  vehicle: Vehicle | VehicleOffer;
  // On the fleet page a model is shown once, at the lowest price among its cars.
  fromPrice?: Money;
  // Shown under the price, e.g. how many branches have the model.
  note?: ReactNode;
  // Where the card leads: the car's own page. The fleet catalogue has no page per model.
  href?: ComponentProps<typeof Link>["href"];
};

export async function VehicleCard({ vehicle, fromPrice, note, href }: VehicleCardProps) {
  const t = await getTranslations("Vehicle");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";
  const offer = "totalPrice" in vehicle ? vehicle : null;

  const specs = [
    { icon: Users, label: t("seats", { count: vehicle.seats }) },
    { icon: Luggage, label: t("bags", { count: vehicle.bags }) },
    { icon: Cog, label: t(`transmission.${vehicle.transmission}`) },
    { icon: Fuel, label: t(`fuel.${vehicle.fuelType}`) },
  ];

  return (
    <article className="relative flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
      <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} />
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <h3 className="text-h3 text-fg">
            {href ? (
              // The link's ::after covers the whole card, so the card is one big target.
              <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
                {vehicle.brand} {vehicle.model}
              </Link>
            ) : (
              <>
                {vehicle.brand} {vehicle.model}
              </>
            )}
          </h3>
          <p className="text-small text-fg-muted">
            {vehicle.vehicleClass.name[locale]} · {vehicle.year}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-small text-fg-muted">
          {specs.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-border pt-3">
          <p className="text-h3 tabular-nums text-fg">
            {fromPrice
              ? t("fromPerDay", { price: formatMoney(format, fromPrice) })
              : t("perDay", { price: formatMoney(format, vehicle.dailyPrice) })}
          </p>
          {offer && (
            <p className="text-small tabular-nums text-fg-muted">
              {t("total", { days: offer.days, price: formatMoney(format, offer.totalPrice) })}
            </p>
          )}
          {note && <p className="text-small text-fg-muted">{note}</p>}
        </div>
      </div>
    </article>
  );
}
