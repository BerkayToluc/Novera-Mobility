import { Cog, Fuel, Gauge, Luggage, Users, Zap, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Vehicle } from "@/lib/vehicle";

export type VehicleFact = { key: string; icon: LucideIcon; label: string };

// The short facts of a car on the results page, in the order a renter weighs them: what it burns
// per 100 km, what it runs on, how it shifts, then room. The same list feeds the card and the
// wide row (SPEC §2.3); the fleet section has its own client version in components/fleet.
export async function getVehicleFacts(vehicle: Vehicle): Promise<VehicleFact[]> {
  const t = await getTranslations("Vehicle");
  const format = await getFormatter();
  const value = format.number(vehicle.consumption.value, { maximumFractionDigits: 1 });
  return [
    { key: "consumption", icon: Gauge, label: t(`consumption.${vehicle.consumption.unit}`, { value }) },
    { key: "fuel", icon: vehicle.fuelType === "ELECTRIC" ? Zap : Fuel, label: t(`fuel.${vehicle.fuelType}`) },
    { key: "transmission", icon: Cog, label: t(`transmission.${vehicle.transmission}`) },
    { key: "seats", icon: Users, label: t("seats", { count: vehicle.seats }) },
    { key: "bags", icon: Luggage, label: t("bags", { count: vehicle.bags }) },
  ];
}
