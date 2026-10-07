import type { routing } from "@/i18n/routing";

type AppPathname = keyof typeof routing.pathnames;

// The five site-navigation entries of SPEC §2.4. `labelKey` is a key of the
// "Header" messages; the footer reuses the same list so the two never drift.
export const NAV_ITEMS = [
  { href: "/", labelKey: "home" },
  { href: "/urunler", labelKey: "products" },
  { href: "/hizmetler", labelKey: "services" },
  { href: "/hakkimizda", labelKey: "about" },
  { href: "/iletisim", labelKey: "contact" },
] as const satisfies readonly { href: AppPathname; labelKey: string }[];
