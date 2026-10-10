// Fictional company details (SPEC §2.6). The address domain is reserved (.example), so no
// message can reach a real person; the phone follows the sample branches' 555 pattern.
// One source for the footer and the contact page.
export const COMPANY = {
  email: "iletisim@novera.example",
  phone: "+90 212 555 00 00",
} as const;

// The head office the contact page shows (SPEC §2.6). Made up, like the rest.
export const HEADQUARTERS = {
  address: "Maslak Mah. Büyükdere Cad. No: 100, Sarıyer, İstanbul",
  latitude: 41.1086,
  longitude: 29.0204,
} as const;

// Direct addresses of the teams a visitor may want (SPEC §2.6); the labels are in the messages.
export const DEPARTMENTS = [
  { key: "marketing", email: "pazarlama@novera.example" },
  { key: "sales", email: "satis@novera.example" },
  { key: "partnerships", email: "isbirlikleri@novera.example" },
] as const;

// "Bizi takip edin" (SPEC §2.8): shown, never linked, until the company has real accounts.
export const SOCIAL_NETWORKS = ["instagram", "linkedin", "x", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

// tel: links need the number without spaces.
export const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;

export const HQ_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${HEADQUARTERS.latitude},${HEADQUARTERS.longitude}`;
