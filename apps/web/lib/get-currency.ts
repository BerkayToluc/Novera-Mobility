import "server-only";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE, parseCurrency, type Currency } from "./currency";

// The currency the visitor chose, to send as `?currency=` when the API serves prices
// (the backend converts; see ARCHITECTURE ADR-15).
export async function getCurrency(): Promise<Currency> {
  return parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
}
