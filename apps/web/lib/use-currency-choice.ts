"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE, type Currency } from "./currency";

// Outside the hook: it writes to the document, which is not React state.
function saveCurrency(currency: Currency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}; samesite=lax`;
}

// The prices on the page come from the server already converted (the backend owns the exchange rates, ADR-15), so
// choosing a currency means asking the server again: the choice is written to the cookie the server reads, then the
// page is refreshed. Shared by the header's currency menu and the mobile menu's switcher (V2-14, QUALITY M-07).
export function useCurrencyChoice(initialCurrency: Currency) {
  const router = useRouter();
  const [choice, setChoice] = useState<Currency>(initialCurrency);

  function choose(currency: Currency) {
    saveCurrency(currency);
    setChoice(currency);
    router.refresh();
  }

  return { choice, choose };
}
