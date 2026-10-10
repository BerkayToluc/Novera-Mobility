import type { Money } from "./currency";
import type { Consumption, FuelType, Transmission, Vehicle } from "./vehicle";

// One car model as the fleet page shows it (SPEC §2.4): the API lists cars, one per branch,
// so cars of the same model are folded into one entry that keeps the lowest daily price and
// the branches that stock it. Plain data only: it crosses to the client as props.
export type FleetBranch = { id: string; name: string; city: string };

export type FleetModel = {
  slug: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  consumption: Consumption;
  description: string;
  imageUrl: string | null;
  fromPrice: Money;
  branches: FleetBranch[];
};

export type FleetCategory = { slug: string; name: string; models: FleetModel[] };

export function groupFleet(
  vehicles: Vehicle[],
  branches: { id: string; name: string; city: string }[],
  locale: "tr" | "en",
): FleetCategory[] {
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const models = new Map<string, FleetModel & { classSlug: string; className: string }>();

  for (const vehicle of vehicles) {
    const branch = branchById.get(vehicle.branchId);
    const found = models.get(vehicle.modelSlug);
    if (!found) {
      models.set(vehicle.modelSlug, {
        slug: vehicle.modelSlug,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        seats: vehicle.seats,
        bags: vehicle.bags,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        consumption: vehicle.consumption,
        description: vehicle.description[locale],
        imageUrl: vehicle.imageUrl,
        fromPrice: vehicle.dailyPrice,
        branches: branch ? [branch] : [],
        classSlug: vehicle.vehicleClass.slug,
        className: vehicle.vehicleClass.name[locale],
      });
      continue;
    }
    if (branch) found.branches.push(branch);
    if (vehicle.dailyPrice.amount < found.fromPrice.amount) found.fromPrice = vehicle.dailyPrice;
  }

  // Classes from the cheapest to the dearest, and the same inside each (SPEC §2.4).
  const categories = new Map<string, FleetCategory>();
  for (const { classSlug, className, ...model } of models.values()) {
    model.branches.sort((a, b) => a.city.localeCompare(b.city, "tr") || a.name.localeCompare(b.name, "tr"));
    const category = categories.get(classSlug) ?? { slug: classSlug, name: className, models: [] };
    category.models.push(model);
    categories.set(classSlug, category);
  }
  return [...categories.values()]
    .map((category) => ({ ...category, models: category.models.sort((a, b) => a.fromPrice.amount - b.fromPrice.amount) }))
    .sort((a, b) => a.models[0].fromPrice.amount - b.models[0].fromPrice.amount);
}
