// What the administrator sees of a contact message (V2-32, ADMIN.md §3.2). The name, e-mail, phone and the text are personal
// data: on the screen and in the answer, never in the audit log, and gone from the row once the retention task has anonymised
// it (`anonymized`). A message that was anonymised has nothing left to answer, so it never counts as waiting.
type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  createdAt: Date;
  anonymizedAt: Date | null;
  handledAt: Date | null;
  handledBy: { firstName: string; lastName: string; email: string } | null;
};

export type MessageListItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  // The first words of the message, for the list.
  preview: string;
  createdAt: string;
  handledAt: string | null;
  anonymized: boolean;
};

export type MessageDetail = MessageListItem & {
  phone: string | null;
  message: string;
  // Who marked it handled; empty when nobody did, or when that account was removed since.
  handledBy: { name: string; email: string } | null;
};

const PREVIEW_LENGTH = 120;

const previewOf = (message: string): string => {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : flat;
};

export function messageListItem(row: Row): MessageListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    preview: previewOf(row.message),
    createdAt: row.createdAt.toISOString(),
    handledAt: row.handledAt?.toISOString() ?? null,
    anonymized: row.anonymizedAt !== null,
  };
}

export function messageDetail(row: Row): MessageDetail {
  return {
    ...messageListItem(row),
    phone: row.phone,
    message: row.message,
    handledBy: row.handledBy ? { name: `${row.handledBy.firstName} ${row.handledBy.lastName}`.trim(), email: row.handledBy.email } : null,
  };
}

export const MESSAGE_INCLUDE = { handledBy: { select: { firstName: true, lastName: true, email: true } } } as const;
