import type { QuoteSource, QuoteStatus } from '../../generated/prisma/client.js';

// What the administrator sees of a corporate quote request (V2-32, ADMIN.md §3.2). The customer's name, e-mail and phone are
// personal data: they are on the screen and in the answer, never in the audit log, and they are gone from the row once the
// retention task has anonymised it (`anonymized`).
export const QUOTE_STATUSES = ['RECEIVED', 'IN_REVIEW', 'OFFERED', 'CLOSED'] as const satisfies readonly QuoteStatus[];
export const QUOTE_SOURCES = ['WEB', 'FLEET_RENEWAL'] as const satisfies readonly QuoteSource[];

// The order a quote goes through. Skipping ahead is allowed (a request can be answered at once), going back is not.
export const statusRank = (status: QuoteStatus): number => QUOTE_STATUSES.indexOf(status);

// What a quote can be moved to from where it is: every state after it.
export const nextStatuses = (status: QuoteStatus): QuoteStatus[] => QUOTE_STATUSES.filter((entry) => statusRank(entry) > statusRank(status));

type Row = {
  id: string;
  number: string;
  status: QuoteStatus;
  source: QuoteSource;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  vehicleCount: number;
  durationMonths: number;
  vehicleType: string;
  deliveryCities: string | null;
  notes: string | null;
  internalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  anonymizedAt: Date | null;
  product: { slug: string } | null;
  user: { id: string; email: string } | null;
};

export type QuoteListItem = {
  number: string;
  status: QuoteStatus;
  source: QuoteSource;
  companyName: string;
  contactName: string | null;
  email: string;
  vehicleCount: number;
  durationMonths: number;
  vehicleType: string;
  productSlug: string | null;
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
  // The personal fields were erased by the retention task (V2-12).
  anonymized: boolean;
};

export type QuoteDetail = QuoteListItem & {
  id: string;
  phone: string | null;
  deliveryCities: string | null;
  notes: string | null;
  // Only staff read this; it is in no answer to the customer.
  internalNote: string | null;
  // The account that sent it, when it was sent signed in.
  account: { email: string } | null;
  // The states it can still be moved to.
  nextStatuses: QuoteStatus[];
};

export function quoteListItem(row: Row): QuoteListItem {
  return {
    number: row.number,
    status: row.status,
    source: row.source,
    companyName: row.companyName,
    contactName: row.contactName,
    email: row.email,
    vehicleCount: row.vehicleCount,
    durationMonths: row.durationMonths,
    vehicleType: row.vehicleType,
    productSlug: row.product?.slug ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    anonymized: row.anonymizedAt !== null,
  };
}

export function quoteDetail(row: Row): QuoteDetail {
  return {
    ...quoteListItem(row),
    id: row.id,
    phone: row.phone,
    deliveryCities: row.deliveryCities,
    notes: row.notes,
    internalNote: row.internalNote,
    account: row.user ? { email: row.user.email } : null,
    nextStatuses: nextStatuses(row.status),
  };
}

export const QUOTE_INCLUDE = {
  product: { select: { slug: true } },
  user: { select: { id: true, email: true } },
} as const;

// The number as it is stored: "TKL-2026-00042", in capitals. People type it in any case.
export const normalizeQuoteNumber = (raw: string): string | null => {
  const upper = raw.trim().toUpperCase();
  return /^TKL-\d{4}-\d{4,}$/.test(upper) ? upper : null;
};
