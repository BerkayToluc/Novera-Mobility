import "server-only";
import { buildBranchOptions, type BranchOption } from "./branch-options";
import { getBranchDetails } from "./fleet-client";

// The branches for the rental form, each with its opening hours. Throws when the API cannot
// be reached; the pages catch that and show their "could not be loaded" state.
export async function getBranchOptions(): Promise<BranchOption[]> {
  return buildBranchOptions(await getBranchDetails());
}
