// `pnpm audit:prod`: the dependency audit CI runs (V2-18). See scripts/lib/audit-policy.mjs for the rule.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evaluateAudit, MAX_REVIEW_AGE_DAYS } from "./lib/audit-policy.mjs";

const allowlist = JSON.parse(readFileSync(new URL("./audit-allowlist.json", import.meta.url), "utf8"));
const run = spawnSync("pnpm", ["audit", "--prod", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" });

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  // No answer from the registry is not "no findings": the check must not pass by accident.
  console.error("The audit gave no readable answer (registry unreachable?). Output:\n" + (run.stdout || run.stderr));
  process.exit(2);
}

const { failures, allowed, stale } = evaluateAudit(report.advisories, allowlist);
const total = Object.keys(report.advisories ?? {}).length;
console.log(`pnpm audit --prod: ${total} advisories in all, ${failures.length} blocking, ${allowed.length} allowed.`);

for (const item of allowed) console.log(`  allowed  ${item.label}\n           ${item.reason} (reviewed ${item.reviewed})`);
for (const id of stale) console.warn(`  note     allowlist entry ${id} no longer matches an advisory: remove it from scripts/audit-allowlist.json`);

if (failures.length > 0) {
  console.error("\nBlocking (high or critical, in what the app ships):");
  for (const item of failures) {
    console.error(`  FAIL  ${item.label}\n        ${item.reason}\n        e.g. ${item.paths.slice(0, 2).join("\n             ")}`);
  }
  console.error(`\nUpdate the package, or (only if it never runs in the app) add it to scripts/audit-allowlist.json with a reason; entries expire after ${MAX_REVIEW_AGE_DAYS} days.`);
  process.exit(1);
}
