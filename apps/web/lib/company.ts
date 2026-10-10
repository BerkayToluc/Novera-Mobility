// Fictional company details (SPEC §2.6). The address domain is reserved (.example), so no
// message can reach a real person; the phone follows the sample branches' 555 pattern.
// One source for the footer now and the contact page later (BACKLOG Y22).
export const COMPANY = {
  email: "iletisim@novera.example",
  phone: "+90 212 555 00 00",
} as const;

// "Bizi takip edin" (SPEC §2.8): shown, never linked, until the company has real accounts.
export const SOCIAL_NETWORKS = ["instagram", "linkedin", "x", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

// tel: links need the number without spaces.
export const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;
