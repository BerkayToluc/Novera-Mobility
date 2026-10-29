import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Href } from "./types";

export type ChipOption = { value: string; label: string; href: Href; count?: number };

// Chips above a list (ADMIN.md §3.4): the choice is in the address, so it can be shared and survives a reload; a chip is a
// link and the one for the current choice is marked. The same look as the bookings chips of the profile.
export function FilterChips({ label, options, current }: { label: string; options: readonly ChipOption[]; current: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === current;
          return (
            <li key={option.value}>
              <Link
                href={option.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors",
                  active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
                )}
              >
                {option.label}
                {option.count !== undefined && <span className="tabular-nums">{option.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
