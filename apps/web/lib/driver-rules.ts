// Who may drive (SPEC §2.10, G's decision of 15 October): anyone over 18 who holds a valid driving
// licence, whatever the car. The earlier table of ages and years by vehicle class was an invention
// of mine and is gone. What is left is the age and, for one licence country, the international
// permit; the country list is short on purpose: a table to read, not a world list.
export const MIN_AGE = 18;

export const LICENCE_COUNTRIES = ["TR", "DE", "GB", "US"] as const;
export type LicenceCountry = (typeof LICENCE_COUNTRIES)[number];

export const isLicenceCountry = (value: string): value is LicenceCountry =>
  (LICENCE_COUNTRIES as readonly string[]).includes(value);

// Whether the renter must also hold an international driving permit (an example, not a legal fact).
const PERMIT_REQUIRED: Record<LicenceCountry, boolean> = { TR: false, DE: false, GB: false, US: true };

export type DriverRequirements = {
  minAge: number;
  internationalPermit: boolean;
};

export function requirementsFor(country: LicenceCountry): DriverRequirements {
  return { minAge: MIN_AGE, internationalPermit: PERMIT_REQUIRED[country] };
}

export const needsInternationalPermit = (country: LicenceCountry) => PERMIT_REQUIRED[country];
