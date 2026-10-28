import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import type { Money } from "@/lib/currency";
import type { Vehicle, VehicleOffer } from "@/lib/vehicle";
import { getVehicleFacts } from "./vehicle-facts";
import { VehicleImage } from "./vehicle-image";
import { VehiclePrice } from "./vehicle-price";

export type VehicleViewProps = {
  vehicle: Vehicle | VehicleOffer;
  // On the fleet page a model is shown once, at the lowest price among its cars.
  fromPrice?: Money;
  // Shown under the price, e.g. how many branches have the model.
  note?: ReactNode;
  // The card's button, e.g. "Kirala" on the results page.
  action?: ReactNode;
  // Paying with points: how many, and what is left to pay in money (SPEC §2.3).
  pointsPayment?: { points: number; rest: Money };
  // True for the first card of the results, whose photo is the largest thing on the screen.
  preloadImage?: boolean;
};

// One car as a card, for the grid view of the results (SPEC §2.3).
export async function VehicleCard({ vehicle, fromPrice, note, action, pointsPayment, preloadImage }: VehicleViewProps) {
  const locale = (await getLocale()) as "tr" | "en";
  const facts = await getVehicleFacts(vehicle);

  return (
    <article className="flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} preload={preloadImage} />
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <h3 className="text-h3 text-fg">
            {vehicle.brand} {vehicle.model}
          </h3>
          <p className="text-small text-fg-muted">
            {vehicle.year ? `${vehicle.vehicleClass.name[locale]} · ${vehicle.year}` : vehicle.vehicleClass.name[locale]}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-small text-fg-muted">
          {facts.map(({ key, icon: Icon, label }) => (
            <li key={key} className="flex items-center gap-2">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-border pt-3">
          <VehiclePrice vehicle={vehicle} fromPrice={fromPrice} note={note} pointsPayment={pointsPayment} />
        </div>
        {action}
      </div>
    </article>
  );
}
