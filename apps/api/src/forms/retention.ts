// How long a contact message or a quote request keeps its personal fields (SPEC §7, G's decision of 22 Ekim: 2 years),
// and what is left of a record after it was anonymised (V2-12, QUALITY V-07, KVKK). The company name, the vehicle
// request, the status and the dates stay, so the figures a report needs are still there.
export const RETENTION_YEARS = 2;

// Shown in place of a name; the columns that cannot be empty hold an empty text.
export const ERASED_NAME = 'Silindi';

export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
  return cutoff;
}

export function erasedQuoteFields(now: Date) {
  return { contactName: ERASED_NAME, email: '', phone: null, notes: null, anonymizedAt: now };
}

export function erasedContactFields(now: Date) {
  return { name: ERASED_NAME, email: '', phone: null, message: '', anonymizedAt: now };
}
