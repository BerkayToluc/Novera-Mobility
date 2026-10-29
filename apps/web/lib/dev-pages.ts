// The development-only pages (`/dev/*`) are 404 on a real site. A test run starts the production build (e2e, `next start`), so
// it also opens them, the way it opens the sample data: with the test-run flag, which a real deployment never has and which
// is ignored on Vercel's production deployment (lib/mode.ts). The component gallery of the panel is walked this way in CI.
export function devPagesOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.NOVERA_E2E === "1" && env.VERCEL_ENV !== "production";
}
