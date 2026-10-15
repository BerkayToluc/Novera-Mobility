import type { CurrencyCode } from './reservation-input.js';

// Puan kuralı (SPEC §2.9, G ile 10 Ekim'de kararlaştırıldı): TRY karşılığı üzerinden her TAM ₺100 için 1 puan.
// Ek hizmetler dahildir, kalan kuruş puan getirmez. Tutarlar alt birimdedir: ₺100 = 10 000 kuruş.
export const POINT_STEP_TRY_MINOR = 10_000;

// `total` rezervasyonun kendi para birimindedir; `rate` rezervasyon anındaki kurdur (1 TRY = ? currency).
export function pointsForTotal(total: number, currency: CurrencyCode, rate: number): number {
  const tryMinor = currency === 'TRY' ? total : Math.round(total / rate);
  return Math.max(0, Math.floor(tryMinor / POINT_STEP_TRY_MINOR));
}

export const POINTS_RULES = {
  tr: 'Her tam ₺100 harcamanız için 1 puan kazanırsınız (ek hizmetler dahil). Puanlar kiralama tamamlandığında hesabınıza geçer; iptal edilen rezervasyon puan kazandırmaz.',
  en: 'You earn 1 point for every full ₺100 you spend (extras included). Points are credited once the rental is completed; a cancelled booking earns no points.',
};
