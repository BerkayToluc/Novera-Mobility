// The rule behind `pnpm audit:prod` (V2-18, QUALITY G-18): a high or critical advisory in what the running app ships
// fails the build, unless it is on the allowlist for a reason that is written down and was looked at recently.
//
// An allowlist entry is not "ignore this package": it only covers an advisory that reaches the app through one
// dependency path prefix (for instance the Prisma command-line tool, which is never loaded by the running API). The
// same package turning up on any other path is a new finding. An entry also expires: its review date must be
// within MAX_REVIEW_AGE_DAYS, so nothing stays allowed just because nobody looked again.
export const BLOCKING = new Set(["high", "critical"]);
export const MAX_REVIEW_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// `advisories` is the `advisories` object of `pnpm audit --json`; `allowlist` is scripts/audit-allowlist.json.
// Returns what failed and what was let through, so the caller can print both.
export function evaluateAudit(advisories, allowlist, today = new Date()) {
  const failures = [];
  const allowed = [];
  const seen = new Set();

  for (const advisory of Object.values(advisories ?? {})) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const id = advisory.github_advisory_id ?? String(advisory.url ?? "").split("/").pop();
    const paths = (advisory.findings ?? []).flatMap((finding) => finding.paths ?? []);
    const entry = allowlist.find((item) => item.id === id);
    const label = `${advisory.severity.toUpperCase()} ${advisory.module_name} ${advisory.vulnerable_versions} (${id}): ${advisory.title}`;

    if (!entry) {
      failures.push({ label, reason: "not on the allowlist", paths });
      continue;
    }
    seen.add(entry.id);
    const outside = paths.filter((path) => !path.startsWith(entry.pathPrefix));
    if (outside.length > 0) {
      failures.push({ label, reason: `reaches the app outside "${entry.pathPrefix}"`, paths: outside });
      continue;
    }
    const age = Math.floor((today.getTime() - new Date(`${entry.reviewed}T00:00:00Z`).getTime()) / DAY_MS);
    if (!Number.isFinite(age) || age > MAX_REVIEW_AGE_DAYS) {
      failures.push({ label, reason: `allowlist review is older than ${MAX_REVIEW_AGE_DAYS} days (reviewed ${entry.reviewed})`, paths });
      continue;
    }
    allowed.push({ label, reason: entry.reason, reviewed: entry.reviewed });
  }

  // An entry whose advisory is gone (fixed upstream) is dead weight and a loophole for later: say so.
  const stale = allowlist.filter((item) => !seen.has(item.id)).map((item) => item.id);
  return { failures, allowed, stale };
}
