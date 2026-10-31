import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCanonical, checkDocsClosed, checkHeaders, checkHealth, checkKeyRequired, checkKeyWorks, checkRobots, checkSitemap, summarize } from "./lib/live-checks.mjs";

const WEB = "https://novera.example";
const sitemap = (...locs) => `<?xml version="1.0"?><urlset>${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join("")}</urlset>`;
const headers = (over = {}) =>
  new Headers({ "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc123'", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=63072000; includeSubDomains", ...over });

test("a sitemap whose addresses are all on the real domain passes", () => {
  const found = checkSitemap(200, sitemap(`${WEB}/`, `${WEB}/en/fleet`), WEB);
  assert.equal(found.ok, true);
  assert.match(found.detail, /2 addresses/);
});

test("a sitemap that still says localhost, or another host, fails and names the first", () => {
  const found = checkSitemap(200, sitemap(`${WEB}/`, "http://localhost:3000/filo"), WEB);
  assert.equal(found.ok, false);
  assert.match(found.detail, /localhost:3000/);
  assert.equal(checkSitemap(200, sitemap("https://novera.example.evil.test/"), WEB).ok, false);
});

test("an empty sitemap, or an error, fails", () => {
  assert.equal(checkSitemap(200, "<urlset></urlset>", WEB).ok, false);
  assert.equal(checkSitemap(500, "", WEB).ok, false);
  assert.equal(checkSitemap(0, "", WEB).ok, false);
});

test("robots.txt must point at the sitemap of the real address", () => {
  assert.equal(checkRobots(200, `User-Agent: *\nAllow: /\n\nSitemap: ${WEB}/sitemap.xml\n`, WEB).ok, true);
  assert.equal(checkRobots(200, "User-Agent: *\nSitemap: http://localhost:3000/sitemap.xml\n", WEB).ok, false);
  assert.equal(checkRobots(404, "", WEB).ok, false);
});

test("the canonical and share addresses must be the real address", () => {
  const html = (canonical, share) => `<head><link rel="canonical" href="${canonical}"/><meta property="og:url" content="${share}"/></head>`;
  assert.equal(checkCanonical(200, html(`${WEB}/`, `${WEB}/`), WEB).ok, true);
  assert.equal(checkCanonical(200, html("http://localhost:3000/", `${WEB}/`), WEB).ok, false);
  assert.equal(checkCanonical(200, html(`${WEB}/`, "http://localhost:3000/"), WEB).ok, false);
  assert.equal(checkCanonical(200, "<head></head>", WEB).ok, false);
  // A check of a local server expects a local address.
  assert.equal(checkCanonical(200, html("http://localhost:3000", "http://localhost:3000"), "http://localhost:3000").ok, true);
});

test("the headers: CSP with a nonce, nosniff, frame options, and HSTS on https", () => {
  assert.equal(checkHeaders(headers(), WEB).ok, true);
  assert.match(checkHeaders(headers({ "strict-transport-security": "" }), WEB).detail, /Strict-Transport-Security/);
  assert.match(checkHeaders(headers({ "content-security-policy": "default-src 'self'" }), WEB).detail, /nonce/);
  assert.match(checkHeaders(headers({ "x-content-type-options": "" }), WEB).detail, /nosniff/);
  // Plain http (a local check) does not ask for HSTS.
  assert.equal(checkHeaders(headers({ "strict-transport-security": "" }), "http://localhost:3200").ok, true);
});

test("the API: health answers, the key is required, docs are closed", () => {
  assert.equal(checkHealth(200, '{"status":"ok"}').ok, true);
  assert.equal(checkHealth(200, "<html>").ok, false);
  assert.equal(checkHealth(0, "").ok, false);
  assert.equal(checkKeyRequired(404).ok, true);
  assert.equal(checkKeyRequired(200).ok, false);
  assert.equal(checkDocsClosed(404).ok, true);
  assert.equal(checkDocsClosed(200).ok, false);
  assert.equal(checkKeyWorks(200).ok, true);
  assert.equal(checkKeyWorks(404).ok, false);
});

test("no check puts a key in its message", () => {
  const all = [checkKeyRequired(404), checkKeyWorks(404), checkDocsClosed(200)];
  for (const item of all) assert.doesNotMatch(JSON.stringify(item), /secret/i);
});

test("the summary counts the failures", () => {
  assert.deepEqual(summarize([{ ok: true }, { ok: false }, { ok: true }]), { total: 3, failed: 1, ok: false });
  assert.equal(summarize([]).ok, true);
});
