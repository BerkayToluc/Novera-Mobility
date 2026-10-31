"use server";

import { getFleetRoute, getFleetTracking } from "./fleet-server";
import { getSession } from "./session";
import { routeDays, type RefreshResult } from "./tracking";
import { istanbulDate } from "./simulation";

// The refresh of the live tracking screen every thirty seconds (V2-43). It is a read, but an action is a public address and the sample mode
// has no API to check the caller, so it asks who is calling first, like the writes of Filom do (fleet-actions.ts). With the API the caller is
// checked again by the API on every call (CompanyGuard, ADR-25).
async function isFleetCaller(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session && session.type === "corporate" && session.role === "customer" && session.hasFleet);
}

export async function refreshTracking(plate: string | null, day: string | null): Promise<RefreshResult> {
  if (!(await isFleetCaller())) return { status: "unavailable" };
  try {
    const tracking = await getFleetTracking();
    // Only a car in the list has a route to draw, and only on a day the API would answer for.
    const today = istanbulDate(Date.parse(tracking.updatedAt));
    const wanted = typeof plate === "string" && tracking.items.some((item) => item.plate.replace(/\s+/g, "") === plate.replace(/\s+/g, "")) ? plate : null;
    const date = typeof day === "string" && routeDays(today).includes(day) ? day : today;
    const route = wanted ? await getFleetRoute(wanted, date) : null;
    return { status: "ok", tracking, route };
  } catch {
    return { status: "unavailable" };
  }
}

