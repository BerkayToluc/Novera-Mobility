"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";
import { useCurrencyChoice } from "@/lib/use-currency-choice";

// The header's currency choice (SPEC §2.8): the button shows the current symbol and code,
// the panel lists the three with their names. A group of toggle buttons in a popover, not an
// ARIA menu: a menu role promises arrow-key navigation this short list does not need.
export function CurrencyMenu({ initialCurrency, className }: { initialCurrency: Currency; className?: string }) {
  const t = useTranslations("CurrencySwitcher");
  const { choice, choose } = useCurrencyChoice(initialCurrency);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* The name keeps the visible code ("TRY") so voice control can say what it sees. */}
        <Button variant="ghost" size="compact" aria-label={t("current", { code: choice })} className={cn("group", className)}>
          <span aria-hidden="true" className="text-h3 text-link">
            {CURRENCY_SYMBOLS[choice]}
          </span>
          <span aria-hidden="true">{choice}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-fg-muted transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" aria-label={t("label")}>
        <p className="px-2 pb-2 pt-1 text-small text-fg-muted">{t("label")}</p>
        <ul className="flex flex-col gap-1">
          {CURRENCIES.map((currency) => {
            const isCurrent = currency === choice;
            return (
              <li key={currency}>
                <button
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => {
                    choose(currency);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors",
                    isCurrent ? "bg-selected" : "hover:bg-surface-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-h3 text-link"
                  >
                    {CURRENCY_SYMBOLS[currency]}
                  </span>
                  <span className="flex flex-col">
                    <span className={cn("text-label", isCurrent ? "text-on-selected" : "text-fg")}>{currency}</span>
                    <span className="text-small text-fg-muted">{t(`names.${currency}`)}</span>
                  </span>
                  {isCurrent && <Check aria-hidden="true" className="ml-auto size-5 text-on-selected" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
