import type { AdminExtra } from "@/lib/admin-extras";
import type { Currency } from "@/lib/currency";
import type { Extra } from "@/lib/extra";
import { mockConvert } from "./fleet";
import { fleetOf, nextVersion, type ExtraRecord } from "./fleet-world";

// The sample extra services (USE_MOCKS=1, local work and tests only, lib/mode.ts), of one "world" like the rest of the fleet
// (mocks/fleet-world.ts): a price changed in the panel is the price the booking pages show. The real list comes from the API.
const rows = (world: string): ExtraRecord[] => fleetOf(world).extras;

// What the booking pages show: the extras in the visitor's currency.
export function mockExtras(world: string, currency: Currency): Extra[] {
  return rows(world).map((extra) => ({
    slug: extra.slug,
    name: extra.name,
    price: mockConvert({ amount: extra.price, currency: "TRY" }, currency),
    pricing: extra.pricing,
  }));
}

// ---------- What the panel shows ----------
const view = (record: ExtraRecord): AdminExtra => ({ ...record });

export const listMockExtras = (world: string): AdminExtra[] => [...rows(world)].sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug)).map(view);

export function getMockExtra(world: string, slug: string): AdminExtra | null {
  const found = rows(world).find((row) => row.slug === slug.toLowerCase());
  return found ? view(found) : null;
}

export type MockOutcome<T> = { status: "ok"; value: T } | { status: "stale" | "not_found" } | { status: "invalid"; fields: Record<string, string> };

export function updateMockExtra(
  world: string,
  slug: string,
  body: { updatedAt: string; name?: { tr: string; en: string }; price?: number },
): MockOutcome<AdminExtra> {
  const current = rows(world).find((row) => row.slug === slug.toLowerCase());
  if (!current) return { status: "not_found" };
  if (current.updatedAt !== body.updatedAt) return { status: "stale" };
  if (body.price !== undefined && (!Number.isInteger(body.price) || body.price < 0 || body.price > 1_000_000)) {
    return { status: "invalid", fields: { price: "OUT_OF_RANGE" } };
  }
  Object.assign(current, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.price !== undefined ? { price: body.price } : {}),
    updatedAt: nextVersion(current.updatedAt),
  });
  return { status: "ok", value: view(current) };
}
