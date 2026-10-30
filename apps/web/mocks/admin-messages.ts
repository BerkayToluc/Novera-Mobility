import type { AdminMessage, AdminMessageDetail, AdminMessagePage } from "@/lib/admin-messages";
import { normalizeSearch } from "@/lib/branch-detail";
import { fleetOf, type MessageRecord } from "./fleet-world";

// The sample contact messages as the panel sees them (USE_MOCKS=1, local work and tests only, lib/mode.ts). They behave like the
// API's: a message waits until someone marks it handled, the mark can be taken back, and a message whose personal fields were
// erased has nothing left to answer, so it does not wait. They live in the sample fleet of the world (mocks/fleet-world.ts).
const rows = (world: string): MessageRecord[] => fleetOf(world).messages;

const PREVIEW = 120;
const preview = (message: string): string => {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW ? `${flat.slice(0, PREVIEW - 1).trimEnd()}…` : flat;
};

const listItem = (row: MessageRecord): AdminMessage => ({
  id: row.id,
  name: row.name,
  email: row.email,
  subject: row.subject,
  preview: preview(row.message),
  createdAt: row.createdAt,
  handledAt: row.handledAt,
  anonymized: row.anonymized,
});

const detail = (row: MessageRecord): AdminMessageDetail => ({ ...listItem(row), phone: row.phone, message: row.message, handledBy: row.handledBy });

type ListQuery = { page: number; pageSize: number; sort: { key: string; dir: "asc" | "desc" } | null; q: string; handled: boolean | null };

export function listMockMessages(world: string, query: ListQuery): AdminMessagePage {
  const needle = normalizeSearch(query.q);
  let items = rows(world).filter(
    (row) =>
      (!needle || normalizeSearch(`${row.name} ${row.email} ${row.subject}`).includes(needle)) &&
      // The same counting as the summary card: waiting is not handled and not erased.
      (query.handled === null || (query.handled ? row.handledAt !== null : row.handledAt === null && !row.anonymized)),
  );
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  items = [...items].sort((a, b) => sign * (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || a.id.localeCompare(b.id));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize).map(listItem), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockMessage(world: string, id: string): AdminMessageDetail | null {
  const found = rows(world).find((row) => row.id === id);
  return found ? detail(found) : null;
}

// How many wait: the number of the summary card.
export const waitingMessages = (world: string): number => rows(world).filter((row) => row.handledAt === null && !row.anonymized).length;

export type MockOutcome = { status: "ok"; value: AdminMessageDetail } | { status: "not_found" };

// The mark, and taking it back. A message already handled keeps its first mark.
export function handleMockMessage(world: string, id: string, handled: boolean, who: { name: string; email: string }, now = new Date()): MockOutcome {
  const current = rows(world).find((row) => row.id === id);
  if (!current) return { status: "not_found" };
  if (handled) {
    if (!current.handledAt) Object.assign(current, { handledAt: now.toISOString(), handledBy: who });
  } else {
    Object.assign(current, { handledAt: null, handledBy: null });
  }
  return { status: "ok", value: detail(current) };
}
