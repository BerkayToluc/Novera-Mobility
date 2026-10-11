import type { DriverRequirements } from "./driver-rules";

// Dates here are plain "yyyy-mm-dd" strings, never Date objects: a birthday is a calendar day,
// and going through a time zone could move it by one (SPEC §2.10, ADR-16).
export type DriverDates = { birthDate: string; licenceIssuedAt: string };

export type EligibilityReason = "age" | "licence_years";

export type Eligibility = {
  ok: boolean;
  reasons: EligibilityReason[];
  // What the driver has on the rental's first day, for the message.
  ageYears: number;
  licenceYears: number;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar day: 2026-02-30 is not one, and Date alone would let it roll over to March.
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// The day a booking starts, from the search's local "yyyy-mm-ddThh:mm".
export const rentalStartDate = (startAt: string) => startAt.slice(0, 10);

// Whole years from `from` to `to`. Someone born on 29 February has their birthday on 1 March in
// a common year, so on 28 February of that year they are still a year younger.
export function fullYears(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let years = ty - fy;
  if (tm < fm || (tm === fm && td < fd)) years--;
  return years;
}

// Counted on the first day of the rental, not today: someone who turns 21 the day before pickup
// may rent. `now` never enters, so the result is the same on every machine.
export function checkEligibility(driver: DriverDates, requirements: DriverRequirements, rentalStart: string): Eligibility {
  const ageYears = fullYears(driver.birthDate, rentalStart);
  const licenceYears = fullYears(driver.licenceIssuedAt, rentalStart);
  const reasons: EligibilityReason[] = [];
  if (ageYears < requirements.minAge) reasons.push("age");
  if (licenceYears < requirements.minLicenceYears) reasons.push("licence_years");
  return { ok: reasons.length === 0, reasons, ageYears, licenceYears };
}
