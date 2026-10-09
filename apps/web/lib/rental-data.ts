import "server-only";
import { buildBranchOptions, type BranchOption } from "./branch-options";
import type { Currency } from "./currency";
import { getBranches, getVehicles } from "./fleet-client";

// The branches for the rental form, each with the cars it has. Throws when the API cannot
// be reached; the pages catch that and show their "could not be loaded" state.
export async function getBranchOptions(currency: Currency): Promise<BranchOption[]> {
  const [branches, vehicles] = await Promise.all([getBranches(), getVehicles(currency)]);
  return buildBranchOptions(branches, vehicles);
}
