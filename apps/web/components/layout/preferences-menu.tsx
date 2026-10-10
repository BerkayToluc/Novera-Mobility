"use client";

import { useId } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/theme";

// Language and theme behind one header button (SPEC §2.8). The button shows the current
// language code, the thing most visitors come looking for; the theme sits beside it in the panel.
export function PreferencesMenu({ initialTheme, className }: { initialTheme: Theme; className?: string }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const languageId = useId();
  const themeId = useId();
  const code = locale.toUpperCase();

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* The name keeps the visible code ("TR") so voice control can say what it sees. */}
        <Button
          variant="ghost"
          aria-label={t("preferencesLabel", { language: code })}
          size="compact"
          className={cn("group", className)}
        >
          <Globe aria-hidden="true" className="size-5 text-link" />
          <span aria-hidden="true">{code}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-fg-muted transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-5" aria-label={t("preferences")}>
        <section aria-labelledby={languageId} className="flex flex-col gap-2">
          <h2 id={languageId} className="text-small text-fg-muted">
            {t("language")}
          </h2>
          <LocaleSwitcher />
        </section>
        <section aria-labelledby={themeId} className="flex flex-col gap-2 border-t border-border pt-4">
          <h2 id={themeId} className="text-small text-fg-muted">
            {t("theme")}
          </h2>
          <ThemeSwitcher initialTheme={initialTheme} />
        </section>
      </PopoverContent>
    </Popover>
  );
}
