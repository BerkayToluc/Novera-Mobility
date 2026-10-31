// The rules of `pnpm check:live` (V2-45): what a finished live site looks like from the outside. Pure functions over what was fetched, so the rules
// are tested without a network (scripts/live-checks.test.mjs); scripts/check-live.mjs does the fetching and prints the result.
//
// A check answers { name, ok, detail }. `detail` says what was found, never a secret: the API key is not printed or put in a message.

const result = (name, ok, detail) => ({ name, ok, detail });

const origin = (url) => new URL(url).origin;
const looksLocal = (text) => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i.test(text);

// The sitemap names the real domain in every address (NEXT_PUBLIC_SITE_URL), not the development default.
export function checkSitemap(status, xml, web) {
  const name = "sitemap.xml names the real address";
  if (status !== 200) return result(name, false, `answered ${status}`);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
  if (locs.length === 0) return result(name, false, "no <loc> entries");
  const wrong = locs.filter((loc) => !loc.startsWith(`${origin(web)}/`) && loc !== origin(web));
  return wrong.length === 0 ? result(name, true, `${locs.length} addresses, all on ${origin(web)}`) : result(name, false, `${wrong.length} of ${locs.length} are elsewhere, e.g. ${wrong[0]}`);
}

export function checkRobots(status, text, web) {
  const name = "robots.txt points at the sitemap of the real address";
  if (status !== 200) return result(name, false, `answered ${status}`);
  const wanted = `${origin(web)}/sitemap.xml`;
  return text.split(/\r?\n/).some((line) => line.trim().toLowerCase() === `sitemap: ${wanted}`.toLowerCase()) ? result(name, true, wanted) : result(name, false, `no "Sitemap: ${wanted}" line`);
}

// The home page: its canonical address and its share address are the real domain.
export function checkCanonical(status, html, web) {
  const name = "the home page's canonical and share addresses are the real address";
  if (status !== 200) return result(name, false, `answered ${status}`);
  const tag = (pattern) => html.match(pattern)?.[1];
  const canonical = tag(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ?? tag(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i);
  const share = tag(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i) ?? tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i);
  if (!canonical) return result(name, false, "no canonical link");
  // A development address is wrong only on a real domain: a check of a local server expects a local address.
  const bad = [canonical, share].filter((value) => value && ((looksLocal(value) && !looksLocal(web)) || !value.startsWith(origin(web))));
  return bad.length === 0 ? result(name, true, canonical) : result(name, false, `found ${bad[0]}`);
}

// The headers every response carries (next.config.ts, proxy.ts): checked on the live domain, where HSTS is on and the CSP carries a nonce.
export function checkHeaders(headers, web) {
  const name = "the home page carries the security headers";
  const get = (key) => headers.get?.(key) ?? headers[key.toLowerCase()] ?? null;
  const missing = [];
  if (!get("content-security-policy")) missing.push("Content-Security-Policy");
  else if (!/'nonce-[^']+'/.test(get("content-security-policy"))) missing.push("a nonce in the Content-Security-Policy");
  if (get("x-content-type-options") !== "nosniff") missing.push("X-Content-Type-Options: nosniff");
  if (!get("x-frame-options")) missing.push("X-Frame-Options");
  if (new URL(web).protocol === "https:" && !/max-age=\d{6,}/.test(get("strict-transport-security") ?? "")) missing.push("Strict-Transport-Security");
  return missing.length === 0 ? result(name, true, "CSP with a nonce, nosniff, frame options" + (new URL(web).protocol === "https:" ? ", HSTS" : "")) : result(name, false, `missing ${missing.join(", ")}`);
}

export function checkHealth(status, body) {
  const name = "the API answers /health";
  if (status !== 200) return result(name, false, `answered ${status}`);
  return /"status"\s*:\s*"ok"/.test(body) ? result(name, true, "status ok") : result(name, false, "unexpected body");
}

// In production the API is only for the web server: a call with no key is answered as if the route did not exist.
export function checkKeyRequired(status) {
  return result("the API without its key answers 404", status === 404, `answered ${status}`);
}

export function checkDocsClosed(status) {
  return result("the API's /docs is closed (404)", status === 404, `answered ${status}`);
}

// Only when the key is given (never printed): the same call with the key is let through, so the key on this machine is the one the API holds.
export function checkKeyWorks(status) {
  return result("the API with its key answers", status === 200, `answered ${status}`);
}

export function summarize(checks) {
  const failed = checks.filter((check) => !check.ok);
  return { total: checks.length, failed: failed.length, ok: failed.length === 0 };
}
