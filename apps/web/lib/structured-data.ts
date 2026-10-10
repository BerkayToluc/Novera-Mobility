import type { BranchDetail, DayHours, OpeningHours } from "./branch-detail";
import { COMPANY, HEADQUARTERS } from "./company";
import { SITE_URL } from "./site-url";

// schema.org descriptions of the company and its branches (ARCHITECTURE ADR-18). No `sameAs`
// links to social networks: the company has no real accounts, and none is invented.

export function organizationJsonLd({ name, description }: { name: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    description,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    address: { "@type": "PostalAddress", streetAddress: HEADQUARTERS.address, addressCountry: "TR" },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: COMPANY.phone,
        email: COMPANY.email,
        availableLanguage: ["tr", "en"],
      },
    ],
  };
}

const DAYS = {
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  saturday: ["Saturday"],
  sunday: ["Sunday"],
} as const;

function specification(day: keyof OpeningHours, hours: DayHours) {
  if (!hours) return [];
  // "24:00" is how the sample data writes "until midnight"; schema.org wants 23:59.
  const closes = hours.close === "24:00" ? "23:59" : hours.close;
  return [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[day], opens: hours.open, closes }];
}

export function branchJsonLd(branch: BranchDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: branch.name,
    telephone: branch.phone,
    email: branch.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.address,
      addressLocality: branch.city,
      addressCountry: "TR",
    },
    geo: { "@type": "GeoCoordinates", latitude: branch.latitude, longitude: branch.longitude },
    openingHoursSpecification: (["weekdays", "saturday", "sunday"] as const).flatMap((day) =>
      specification(day, branch.openingHours[day]),
    ),
  };
}
