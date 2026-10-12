import "server-only";
import type { LicenceCountry } from "./driver-rules";

export type LicenceStatus = "valid" | "not_found" | "expired" | "unavailable";

// The simulated licence check (SPEC §2.10). There is no real service and no real licence is ever
// entered: the page says it is a trial, and the outcome comes from the last character of the
// number, so every result can be reached. When a real check exists, this is where it is called;
// without USE_MOCKS the site says the service is unavailable, like the other stand-ins.
//   ends in 0 -> the licence has expired
//   ends in 9 -> no such licence
//   anything else -> valid
export async function verifyLicence(input: {
  country: LicenceCountry;
  number: string;
  issuedAt: string;
}): Promise<LicenceStatus> {
  if (process.env.USE_MOCKS !== "1") return "unavailable";
  const last = input.number.trim().slice(-1);
  if (last === "0") return "expired";
  if (last === "9") return "not_found";
  return "valid";
}
