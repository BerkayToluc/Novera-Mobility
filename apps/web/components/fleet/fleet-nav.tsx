"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { FLEET_SCREENS, isCurrentFleetScreen } from "@/lib/fleet-screens";

// The menu of Filom (DESIGN.md §8), the same as the administration's: from xl a column on the left with an icon for each screen, below
// that one button on top that opens the list. The open list closes by itself on a new page, on Escape (focus returns to the button) and
// on a click anywhere else.
export function FleetNav() {
  const t = useTranslations("FleetPanel.nav");
  const pathname = usePathname();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A new page closes the list (derived while rendering, not in an effect, so there is no flash of the old state).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const current = FLEET_SCREENS.find((screen) => isCurrentFleetScreen(pathname, screen.href)) ?? FLEET_SCREENS[0]!;
  const CurrentIcon = current.icon;

  return (
    <nav
      ref={rootRef}
      aria-label={t("label")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      className="flex flex-col gap-2 xl:sticky xl:top-8 xl:self-start"
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-label text-fg hover:bg-selected xl:hidden"
      >
        <CurrentIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1 text-left">{t("menuCurrent", { current: t(current.key) })}</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <ul id={listId} className={cn("flex-col gap-1", open ? "flex" : "hidden", "xl:flex")}>
        {FLEET_SCREENS.map(({ key, href, icon: Icon }) => {
          const isCurrent = isCurrentFleetScreen(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href as "/filom"}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-label transition-colors",
                  isCurrent ? "bg-selected text-on-selected" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
