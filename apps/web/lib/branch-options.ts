import type { BranchDetail, OpeningHours } from "./branch-detail";

// A branch as the rental form lists it: its name with the city, and its opening hours, so the
// choice of branch also says whether it is open (SPEC §2.2.2).
export type BranchOption = {
  id: string;
  label: string;
  openingHours: OpeningHours;
  // Where the branch is, for "use my location" (SPEC §2.2.2).
  latitude: number;
  longitude: number;
};

export function buildBranchOptions(branches: BranchDetail[]): BranchOption[] {
  return [...branches]
    .sort((a, b) => a.city.localeCompare(b.city, "tr") || a.name.localeCompare(b.name, "tr"))
    .map((branch) => ({
      id: branch.id,
      // The city first: "Merkez" alone would not say which of two cities it is.
      label: `${branch.city} · ${branch.name}`,
      openingHours: branch.openingHours,
      latitude: branch.latitude,
      longitude: branch.longitude,
    }));
}
