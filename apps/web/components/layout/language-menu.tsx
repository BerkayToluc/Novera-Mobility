"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LANGUAGE_NAMES } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";

// The header's language choice (SPEC §2.8): the button shows the current flag and code, the panel
// lists each language in its own name with its flag. Links to the same page in the other language,
// not a cookie, so the address and the language always agree.
export function LanguageMenu({ className }: { className?: string }) {
  const t = useTranslations("LocaleSwitcher");
  const currentLocale = useLocale();
  const pathname = usePathname();
  // Dynamic routes (e.g. /urunler/[slug]) need their params to build the other language's URL.
  const params = useParams();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* The name keeps the visible code ("TR") so voice control can say what it sees. */}
        <Button
          variant="ghost"
          size="compact"
          shape="pill"
          aria-label={t("current", { language: LANGUAGE_NAMES[currentLocale as keyof typeof LANGUAGE_NAMES] })}
          className={cn("group", className)}
        >
          <Flag locale={currentLocale as keyof typeof LANGUAGE_NAMES} />
          <span aria-hidden="true">{currentLocale.toUpperCase()}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-fg-muted transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2" aria-label={t("label")}>
        <ul className="flex flex-col gap-1">
          {routing.locales.map((locale) => {
            const isCurrent = locale === currentLocale;
            return (
              <li key={locale}>
                <Link
                  // @ts-expect-error -- TypeScript cannot relate a runtime pathname to its params; next-intl validates them.
                  href={{ pathname, params }}
                  locale={locale}
                  lang={locale}
                  hrefLang={locale}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-1.5 transition-colors",
                    isCurrent ? "bg-selected text-on-selected" : "text-fg hover:bg-surface-muted",
                  )}
                >
                  <Flag locale={locale} />
                  <span className="text-label">{LANGUAGE_NAMES[locale]}</span>
                  {isCurrent && <Check aria-hidden="true" className="ml-auto size-5" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
