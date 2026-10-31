// `pnpm check:live --web https://site --api https://api` (V2-45): looks at the live site from the outside and says what is still wrong. It reads, it
// never writes. Both addresses are optional (check one side at a time). To prove the API's key as well, put it in the environment as
// NOVERA_API_KEY for this one run; it is sent as the key header and never printed.
import { ACCESS_KEY_HEADER } from "./lib/live-constants.mjs";
import { checkCanonical, checkDocsClosed, checkHeaders, checkHealth, checkKeyRequired, checkKeyWorks, checkRobots, checkSitemap, summarize } from "./lib/live-checks.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const web = option("web")?.replace(/\/+$/, "");
const api = option("api")?.replace(/\/+$/, "");
if (!web && !api) {
  console.error("Usage: pnpm check:live --web https://your-site.example --api https://your-api.example");
  process.exit(2);
}

async function get(url, headers = {}) {
  try {
    const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    return { status: response.status, text: await response.text(), headers: response.headers };
  } catch (error) {
    // No answer is not a pass.
    return { status: 0, text: "", headers: new Headers(), error: error instanceof Error ? error.message : "no answer" };
  }
}

const checks = [];
if (web) {
  const [sitemap, robots, home] = await Promise.all([get(`${web}/sitemap.xml`), get(`${web}/robots.txt`), get(`${web}/`)]);
  checks.push(checkSitemap(sitemap.status, sitemap.text, web), checkRobots(robots.status, robots.text, web), checkCanonical(home.status, home.text, web), checkHeaders(home.headers, web));
}
if (api) {
  const [health, bare, docs] = await Promise.all([get(`${api}/health`), get(`${api}/branches`), get(`${api}/docs`)]);
  checks.push(checkHealth(health.status, health.text), checkKeyRequired(bare.status), checkDocsClosed(docs.status));
  const key = process.env.NOVERA_API_KEY?.trim();
  if (key) checks.push(checkKeyWorks((await get(`${api}/branches`, { [ACCESS_KEY_HEADER]: key })).status));
}

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
const summary = summarize(checks);
console.log(`\n${summary.total - summary.failed} of ${summary.total} checks passed.`);
if (!process.env.NOVERA_API_KEY && api) console.log("(The API key itself was not tried: set NOVERA_API_KEY for one run to check it.)");
process.exit(summary.ok ? 0 : 1);
