import type { CurrencyCode } from './reservation-input.js';

// Puan kuralı (SPEC §2.9, G ile 10 Ekim'de kararlaştırıldı): TRY karşılığı üzerinden her TAM ₺100 için 1 puan.
// Ek hizmetler dahildir, kalan kuruş puan getirmez. Tutarlar alt birimdedir: ₺100 = 10 000 kuruş.
export const POINT_STEP_TRY_MINOR = 10_000;

// `total` rezervasyonun kendi para birimindedir; `rate` rezervasyon anındaki kurdur (1 TRY = ? currency).
export function pointsForTotal(total: number, currency: CurrencyCode, rate: number): number {
  const tryMinor = currency === 'TRY' ? total : Math.round(total / rate);
  return Math.max(0, Math.floor(tryMinor / POINT_STEP_TRY_MINOR));
}

// Spending (SPEC §2.3, G's decision of 15 October): 1 point = ₺5, and points cover at most half of the
// total, so a rental is never free. Only lira totals and individual accounts (checked by the caller).
export const POINT_VALUE_TRY_MINOR = 500;
export const MAX_POINTS_SHARE_PERCENT = 50;

// How many points can be spent on a total (TRY minor units) given the spendable balance.
export function redeemablePoints(balance: number, totalTryMinor: number): number {
  const cap = Math.floor((totalTryMinor * MAX_POINTS_SHARE_PERCENT) / 100 / POINT_VALUE_TRY_MINOR);
  return Math.max(0, Math.min(Math.floor(balance), cap));
}

export function pointsWorthMinor(points: number): number {
  return points * POINT_VALUE_TRY_MINOR;
}

export const POINTS_RULES = {
  tr: 'Her tam ₺100 harcamanız için 1 puan kazanırsınız (ek hizmetler dahil; puanla ödenen kısım hariç). Puanlar kiralama tamamlandığında hesabınıza geçer; iptal edilen rezervasyon puan kazandırmaz. 1 puan ₺5 değerindedir; bireysel hesapta ve TL\'de, tutarın en çok yarısını puanla ödeyebilirsiniz. İptalde harcanan puan iade edilir.',
  en: 'You earn 1 point for every full ₺100 you spend (extras included; the part paid with points does not count). Points are credited once the rental is completed; a cancelled booking earns no points. One point is worth ₺5; on an individual account, in lira, you can pay up to half of the total with points. Points you spent are returned if you cancel.',
};