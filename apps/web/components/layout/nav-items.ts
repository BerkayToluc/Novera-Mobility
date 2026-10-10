import type { routing } from "@/i18n/routing";

type AppPathname = keyof typeof routing.pathnames;

// The site-navigation entries of SPEC §2.4. `labelKey` is a key of the
// "Header" messages; the footer reuses the same list so the two never drift.
export const NAV_ITEMS = [
  { href: "/", labelKey: "home" },
  { href: "/araclarimiz", labelKey: "fleet" },
  { href: "/urunler", labelKey: "products" },
  { href: "/hizmetler", labelKey: "services" },
  { href: "/hakkimizda", labelKey: "about" },
  { href: "/iletisim", labelKey: "contact" },
] as const satisfies readonly { href: AppPathname; labelKey: string }[];

// The header sets this one apart from the rest (SPEC §2.8).
export const CONTACT_HREF = "/iletisim" satisfies AppPathname;

// Entries whose header item opens a list of their pages (SPEC §2.8).
export const NAV_MENUS = { "/urunler": "products", "/hizmetler": "services" } as const;
