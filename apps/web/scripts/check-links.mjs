// Broken-link check (BACKLOG Y31): reads the sitemap of a running site, opens every page in it,
// and makes sure every internal link on those pages leads somewhere (a 2xx, after redirects).
// External links are left out on purpose: another site being down on a given day should not turn
// our build red. Usage: node scripts/check-links.mjs [baseUrl]   (default http://localhost:3000)
// The site must already be running, with USE_MOCKS=1 so pages that need the API render.

const base = (process.argv[2] ?? process.env.CHECK_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const baseOrigin = new URL(base).origin;

async function fetchStatus(url) {
  try {
    const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "novera-link-check" } });
    return { status: response.status, text: await response.text() };
  } catch (error) {
    return { status: 0, text: "", error: String(error) };
  }
}

// The sitemap names pages with the address the site will be served from; here they are read
// from the running copy instead, so only the path is kept.
function toLocal(url) {
  const parsed = new URL(url, base);
  return `${baseOrigin}${parsed.pathname}${parsed.search}`;
}

const sitemap = await fetchStatus(`${base}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`Could not read ${base}/sitemap.xml (status ${sitemap.status}). Is the site running?`);
  process.exit(2);
}
const pages = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => toLocal(match[1]));

// Where each link was found, so a failure says which page to fix.
const found = new Map();
const broken = [];

for (const page of pages) {
  const { status, text } = await fetchStatus(page);
  if (status < 200 || status >= 300) {
    broken.push({ url: page, status, from: ["sitemap.xml"] });
    continue;
  }
  for (const match of text.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, "&");
    if (/^(mailto:|tel:|#|javascript:)/.test(href)) continue;
    const url = new URL(href, page);
    if (url.origin !== baseOrigin) continue;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) continue;
    const target = `${baseOrigin}${url.pathname}${url.search}`;
    if (!found.has(target)) found.set(target, new Set());
    found.get(target).add(new URL(page).pathname);
  }
}

// Pages already opened above do not need a second request.
const opened = new Set(pages);
for (const [target, sources] of found) {
  if (opened.has(target)) continue;
  const { status } = await fetchStatus(target);
  if (status < 200 || status >= 300) broken.push({ url: target, status, from: [...sources] });
}

console.log(`Checked ${pages.length} pages and ${found.size} distinct internal links.`);
if (broken.length > 0) {
  console.error(`\n${broken.length} broken link(s):`);
  for (const item of broken) {
    console.error(`  ${item.status || "no response"}  ${item.url}\n      linked from: ${item.from.slice(0, 5).join(", ")}`);
  }
  process.exit(1);
}
console.log("No broken internal links.");
