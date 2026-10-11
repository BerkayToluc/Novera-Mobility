// Who may drive which car (SPEC §2.10). The rule depends on the car's class and on the country that
// issued the driving licence, and it all lives in the two tables below. The values are EXAMPLES
// for a fictional company, not legal facts; G corrects them here and nowhere else.

// Countries a licence can come from. Kept short on purpose: a table to read, not a world list.
export const LICENCE_COUNTRIES = ["TR", "DE", "GB", "US"] as const;
export type LicenceCountry = (typeof LICENCE_COUNTRIES)[number];

export const isLicenceCountry = (value: string): value is LicenceCountry =>
  (LICENCE_COUNTRIES as readonly string[]).includes(value);

type ClassRule = { minAge: number; minLicenceYears: number };

// Keyed by the vehicle class slug (see mocks/fleet.ts and the API's VehicleClass).
const CLASS_RULES: Record<string, ClassRule> = {
  economy: { minAge: 21, minLicenceYears: 2 },
  compact: { minAge: 21, minLicenceYears: 2 },
  suv: { minAge: 23, minLicenceYears: 3 },
  electric: { minAge: 23, minLicenceYears: 2 },
  executive: { minAge: 25, minLicenceYears: 5 },
};

// What Kiralama Koşulları already said before classes had their own rule (21 and 2).
const DEFAULT_CLASS_RULE: ClassRule = { minAge: 21, minLicenceYears: 2 };

type CountryRule = {
  // Years added to the class's licence years when the licence was issued in this country.
  extraLicenceYears: number;
  // Whether the renter must also hold an international driving permit.
  internationalPermit: boolean;
};

const COUNTRY_RULES: Record<LicenceCountry, CountryRule> = {
  TR: { extraLicenceYears: 0, internationalPermit: false },
  DE: { extraLicenceYears: 1, internationalPermit: false },
  GB: { extraLicenceYears: 1, internationalPermit: false },
  US: { extraLicenceYears: 2, internationalPermit: true },
};

export type DriverRequirements = {
  minAge: number;
  minLicenceYears: number;
  internationalPermit: boolean;
};

// The rule of a class alone: what a car's card and the summary show before a country is known.
export function classRequirement(classSlug: string): ClassRule {
  return CLASS_RULES[classSlug] ?? DEFAULT_CLASS_RULE;
}

export function requirementsFor(classSlug: string, country: LicenceCountry): DriverRequirements {
  const base = classRequirement(classSlug);
  const extra = COUNTRY_RULES[country];
  return {
    minAge: base.minAge,
    minLicenceYears: base.minLicenceYears + extra.extraLicenceYears,
    internationalPermit: extra.internationalPermit,
  };
}

export const needsInternationalPermit = (country: LicenceCountry) => COUNTRY_RULES[country].internationalPermit;
