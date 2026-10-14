import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { BookingsFilter } from "./reservation-list";

const FILTERS: { value: BookingsFilter; word: string | null }[] = [
  { value: "all", word: null },
  { value: "upcoming", word: "yaklasan" },
  { value: "past", word: "gecmis" },
  { value: "cancelled", word: "iptal" },
];

// Chips above the bookings (SPEC §2.9, v0.8): all, the ones coming, the finished and the cancelled.
// The choice is in the address (durum=), so it can be shared and survives a reload; a chip is a
// link, the one for the current choice is marked.
export async function BookingsFilterChips({ current }: { current: BookingsFilter }) {
  const t = await getTranslations("Profile.bookings.filters");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, word }) => {
          const active = value === current;
          return (
            <li key={value}>
              <Link
                href={{ pathname: "/profil/rezervasyonlar", query: word ? { durum: word } : {} }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-label transition-colors",
                  active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
                )}
              >
                {t(value)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function parseBookingsFilter(value: string | string[] | undefined): BookingsFilter {
  const word = Array.isArray(value) ? value[0] : value;
  return FILTERS.find((entry) => entry.word === word)?.value ?? "all";
}
