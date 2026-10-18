import "server-only";
import type { LicenceCountry } from "./driver-rules";

export type LicenceStatus = "valid" | "not_found" | "expired" | "unavailable";

// The simulated licence check (SPEC §2.10). There is no real service and no real licence is ever
// entered: the page says it is a trial, and the outcome comes from the last character of the
// number, so every result can be reached. It is part of the product, not a stand-in for a missing
// service, so it runs in production too; when a real check exists, this is where it is called.
//   ends in 0 -> the licence has expired
//   ends in 9 -> no such licence
//   anything else -> valid
export async function verifyLicence(input: {
  country: LicenceCountry;
  number: string;
  issuedAt: string;
}): Promise<LicenceStatus> {
  const last = input.number.trim().slice(-1);
  if (last === "0") return "expired";
  if (last === "9") return "not_found";
  return "valid";
}
