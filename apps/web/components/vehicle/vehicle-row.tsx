import { getLocale } from "next-intl/server";
import type { VehicleViewProps } from "./vehicle-card";
import { getVehicleFacts } from "./vehicle-facts";
import { VehicleImage } from "./vehicle-image";
import { VehiclePrice } from "./vehicle-price";

// One car as a wide row, for the list view of the results (SPEC §2.3, G): the photo, the name and
// the facts as chips, and on the right the price with the Kirala button; like the fleet cards on
// the home page. On a phone the photo shrinks to the left and the price block drops under both.
export async function VehicleRow({ vehicle, note, action, pointsPayment }: VehicleViewProps) {
  const locale = (await getLocale()) as "tr" | "en";
  const facts = await getVehicleFacts(vehicle);

  return (
    <article className="grid grid-cols-media-text items-center gap-x-4 gap-y-3 rounded-card border border-border bg-surface p-3 md:grid-cols-media-text-md md:gap-x-6 md:p-4 xl:grid-cols-media-text-action">
      <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} />

      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <h3 className="text-h3 text-fg">
            {vehicle.brand} {vehicle.model}
          </h3>
          <p className="text-small text-fg-muted">
            {vehicle.year ? `${vehicle.vehicleClass.name[locale]} · ${vehicle.year}` : vehicle.vehicleClass.name[locale]}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {facts.map(({ key, icon: Icon, label }) => (
            <li key={key} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-small text-fg-muted">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* A row of its own under the photo and the facts up to xl (the middle column needs the width); from xl it is the right-hand column. */}
      <div className="col-span-2 flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-center md:justify-between md:gap-6 xl:col-span-1 xl:w-96 xl:flex-col xl:items-stretch xl:justify-start xl:gap-3 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
        <VehiclePrice vehicle={vehicle} note={note} pointsPayment={pointsPayment} align="end" />
        <div className="md:w-56 md:shrink-0 xl:w-auto">{action}</div>
      </div>
    </article>
  );
}
