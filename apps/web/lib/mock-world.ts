import "server-only";
import { cookies } from "next/headers";

// The sample data that the panel can change (the branches, V2-27) is kept per "world", so the e2e tests that change it do not
// show their changes to the tests that count what is on the site (they run side by side against one server). A test that
// changes things sets this cookie to a name of its own; everyone else has no cookie and shares the default world, which only
// ever holds the sample data as it was made. Sample mode only (lib/mode.ts); a real site never reads it.
export const MOCK_WORLD_COOKIE = "novera-mock-world";
export const DEFAULT_WORLD = "main";

// A name is short and plain, so it cannot be used to fill the server's memory with odd keys.
const NAME = /^[a-z0-9-]{1,40}$/;

export async function mockWorld(): Promise<string> {
  const value = (await cookies()).get(MOCK_WORLD_COOKIE)?.value ?? DEFAULT_WORLD;
  return NAME.test(value) ? value : DEFAULT_WORLD;
}

// The time of the sample live tracking (V2-43). The positions move with the clock, so a test that wants to see them move, or to see the
// ignition off at night, says what time it is with this cookie (epoch milliseconds); without it the real clock is used. Sample mode only.
export const MOCK_NOW_COOKIE = "novera-mock-now";

export async function mockNow(): Promise<number> {
  const value = (await cookies()).get(MOCK_NOW_COOKIE)?.value;
  const time = value && /^\d{10,14}$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(time) ? time : Date.now();
}
