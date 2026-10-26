import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAudit } from "./lib/audit-policy.mjs";

const TODAY = new Date("2026-10-26T12:00:00Z");
const PRISMA = "apps__api>@prisma/client>prisma>";
const advisory = (over = {}) => ({
  github_advisory_id: "GHSA-aaaa-bbbb-cccc",
  severity: "high",
  module_name: "pkg",
  vulnerable_versions: "<1.0.0",
  title: "something bad",
  findings: [{ paths: [`${PRISMA}pkg`] }],
  ...over,
});
const entry = (over = {}) => ({ id: "GHSA-aaaa-bbbb-cccc", pathPrefix: PRISMA, reason: "cli only", reviewed: "2026-10-20", ...over });

test("a high advisory that is not on the allowlist fails", () => {
  const result = evaluateAudit({ a: advisory() }, [], TODAY);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].reason, /not on the allowlist/);
});

test("a critical advisory fails too", () => {
  assert.equal(evaluateAudit({ a: advisory({ severity: "critical" }) }, [], TODAY).failures.length, 1);
});

test("moderate and low advisories do not block", () => {
  const result = evaluateAudit({ a: advisory({ severity: "moderate" }), b: advisory({ severity: "low" }) }, [], TODAY);
  assert.deepEqual(result.failures, []);
});

test("an allowlisted advisory on its path passes and is reported", () => {
  const result = evaluateAudit({ a: advisory() }, [entry()], TODAY);
  assert.deepEqual(result.failures, []);
  assert.equal(result.allowed.length, 1);
  assert.equal(result.allowed[0].reviewed, "2026-10-20");
});

test("the same advisory reaching the app on another path is a new finding", () => {
  const result = evaluateAudit({ a: advisory({ findings: [{ paths: [`${PRISMA}pkg`, "apps__web>next>pkg"] }] }) }, [entry()], TODAY);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].reason, /outside/);
  assert.deepEqual(result.failures[0].paths, ["apps__web>next>pkg"]);
});

test("an allowlist entry expires after 90 days", () => {
  assert.equal(evaluateAudit({ a: advisory() }, [entry({ reviewed: "2026-07-28" })], TODAY).failures.length, 0); // 90 days
  const expired = evaluateAudit({ a: advisory() }, [entry({ reviewed: "2026-07-27" })], TODAY); // 91 days
  assert.equal(expired.failures.length, 1);
  assert.match(expired.failures[0].reason, /older than 90 days/);
});

test("a bad review date fails instead of passing", () => {
  assert.equal(evaluateAudit({ a: advisory() }, [entry({ reviewed: "soon" })], TODAY).failures.length, 1);
});

test("an entry whose advisory is gone is reported as stale", () => {
  const result = evaluateAudit({}, [entry()], TODAY);
  assert.deepEqual(result.stale, ["GHSA-aaaa-bbbb-cccc"]);
});

test("no advisories at all is fine", () => {
  assert.deepEqual(evaluateAudit(undefined, [], TODAY), { failures: [], allowed: [], stale: [] });
});

