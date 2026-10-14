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
    <article className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-card border border-border bg-surface p-3 md:grid-cols-[14rem_minmax(0,1fr)_auto] md:gap-x-6 md:p-4 xl:grid-cols-[16rem_minmax(0,1fr)_auto]">
      <VehicleImage imageUrl={vehicle.imageUrl} brand={vehicle.brand} model={vehicle.model} />

      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <h3 className="text-h3 text-fg">
            {vehicle.brand} {vehicle.model}
          </h3>
          <p className="text-small text-fg-muted">
            {vehicle.vehicleClass.name[locale]} · {vehicle.year}
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

      <div className="col-span-2 flex flex-col gap-3 border-t border-border pt-3 md:col-span-1 md:w-60 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <VehiclePrice vehicle={vehicle} note={note} pointsPayment={pointsPayment} align="end" />
        {action}
      </div>
    </article>
  );
}
