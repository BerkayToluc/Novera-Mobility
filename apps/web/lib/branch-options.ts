import type { Branch, Vehicle } from "./vehicle";

// A branch as the rental form shows it: where it is, and which cars it has, so a visitor can
// see "what can I drive from here" while choosing where to pick up.
export type BranchOption = {
  id: string;
  label: string;
  // Brand and model of each car at the branch, one entry per distinct model.
  vehicleNames: string[];
};

export function buildBranchOptions(branches: Branch[], vehicles: Vehicle[]): BranchOption[] {
  const namesByBranch = new Map<string, Set<string>>();
  for (const vehicle of vehicles) {
    const names = namesByBranch.get(vehicle.branchId) ?? new Set<string>();
    names.add(`${vehicle.brand} ${vehicle.model}`);
    namesByBranch.set(vehicle.branchId, names);
  }

  return [...branches]
    .sort((a, b) => a.city.localeCompare(b.city, "tr") || a.name.localeCompare(b.name, "tr"))
    .map((branch) => ({
      id: branch.id,
      // The city first: "Merkez" alone would not say which of two cities it is.
      label: `${branch.city} · ${branch.name}`,
      vehicleNames: [...(namesByBranch.get(branch.id) ?? [])],
    }));
}
