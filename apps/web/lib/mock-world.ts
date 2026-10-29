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
