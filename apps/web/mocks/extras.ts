import type { Currency } from "@/lib/currency";
import type { Extra } from "@/lib/extra";
import { mockConvert } from "./fleet";

// Made-up add-ons (TRY); the real list comes from the backend (BACKLOG #15, #21).
const EXTRAS: Extra[] = [
  { slug: "additional-driver", name: { tr: "Ek sürücü", en: "Additional driver" }, price: { amount: 15000, currency: "TRY" }, pricing: "PER_DAY" },
  { slug: "child-seat", name: { tr: "Çocuk koltuğu", en: "Child seat" }, price: { amount: 10000, currency: "TRY" }, pricing: "PER_DAY" },
  { slug: "full-coverage", name: { tr: "Tam kapsamlı sigorta", en: "Full coverage insurance" }, price: { amount: 30000, currency: "TRY" }, pricing: "PER_DAY" },
  { slug: "wifi", name: { tr: "Araç içi Wi-Fi", en: "In-car Wi-Fi" }, price: { amount: 8000, currency: "TRY" }, pricing: "PER_DAY" },
  { slug: "hgs", name: { tr: "HGS etiketi", en: "Toll tag (HGS)" }, price: { amount: 25000, currency: "TRY" }, pricing: "FIXED" },
];

export function mockExtras(currency: Currency): Extra[] {
  return EXTRAS.map((extra) => ({ ...extra, price: mockConvert(extra.price, currency) }));
}
