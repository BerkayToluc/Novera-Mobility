import type { ExtraPricing } from '../../generated/prisma/client.js';

// What the administrator sees of an extra service (V2-30, ADMIN.md §3.1): its name in both languages, how it is priced, and
// the price in kuruş. Extras are fixed (a child seat, a second driver ...): none is added or removed from the panel.
export const EXTRA_PRICINGS = ['PER_DAY', 'FIXED'] as const satisfies readonly ExtraPricing[];

type Row = { slug: string; nameTr: string; nameEn: string; price: number; pricing: ExtraPricing; updatedAt: Date };

export type ExtraView = {
  slug: string;
  name: { tr: string; en: string };
  // Turkish lira in kuruş, like every price of the API. A new price only reaches bookings made after the change.
  price: number;
  pricing: ExtraPricing;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

export function extraAdminView(row: Row): ExtraView {
  return {
    slug: row.slug,
    name: { tr: row.nameTr, en: row.nameEn },
    price: row.price,
    pricing: row.pricing,
    updatedAt: row.updatedAt.toISOString(),
  };
}
