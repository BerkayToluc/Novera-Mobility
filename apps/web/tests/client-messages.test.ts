import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, ROOT_NAMESPACES } from "../i18n/client-messages";

// V2-15 (QUALITY P-01): the page only sends the text its client components use. This reads the code the way the
// bundler does and checks that i18n/client-messages.ts says exactly that: nothing a component needs is missing
// (it would render a raw key), and nothing is listed that no component uses (it would be sent for nothing).
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app", "[locale]");
const PAGE_FILES = /^(page|layout|loading|error|not-found|template)\.tsx$/;

type Parsed = { client: boolean; imports: string[]; namespaces: string[] };
const parsed = new Map<string, Parsed>();

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = path.normalize(base + ext);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// The directive comes first, after any comments. Walked by hand: a regular expression for "any number of comments, then
// the directive" can backtrack badly on a file full of comment markers (CodeQL).
function startsWithUseClient(source: string): boolean {
  let rest = source.trimStart();
  for (;;) {
    if (rest.startsWith("//")) {
      const end = rest.indexOf("\n");
      if (end === -1) return false;
      rest = rest.slice(end + 1).trimStart();
    } else if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      if (end === -1) return false;
      rest = rest.slice(end + 2).trimStart();
    } else {
      return rest.startsWith('"use client"') || rest.startsWith("'use client'");
    }
  }
}

function parse(file: string): Parsed {
  const cached = parsed.get(file);
  if (cached) return cached;
  const source = readFileSync(file, "utf8");
  const client = startsWithUseClient(source);
  const specs = [...source.matchAll(/(?:import|export)[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]!);
  specs.push(...[...source.matchAll(/import\(\s*["']([^"']+)["']/g)].map((match) => match[1]!));
  const namespaces = [...source.matchAll(/useTranslations\(\s*["']([A-Za-z]+)/g)].map((match) => match[1]!);
  const result = { client, imports: specs.map((spec) => resolveImport(file, spec)).filter((value): value is string => value !== null), namespaces };
  parsed.set(file, result);
  return result;
}

// The namespaces a file sends text for: those of its client components, and of everything a client component imports.
function needs(file: string): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>();
  const visit = (current: string, inClient: boolean) => {
    if (seen.has(current)) return;
    seen.add(current);
    const info = parse(current);
    const client = inClient || info.client;
    if (client) info.namespaces.forEach((name) => found.add(name));
    info.imports.forEach((next) => visit(next, client));
  };
  visit(file, false);
  return found;
}

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (PAGE_FILES.test(entry)) out.push(full);
  }
  return out;
}

const files = routeFiles(APP);
const relative = (file: string) => path.relative(APP, file).split(path.sep).join("/");

// The wrapper whose messages a file sees: its own folder's layout, else the nearest folder above that has one, else
// the root layout. The home page has its own wrapper (`page`). A layout file sits outside its own wrapper, so it is
// served by the folder above (the profile layout wraps its own content and is the exception).
function wrapperOf(file: string): string | null {
  const rel = relative(file);
  if (rel === "page.tsx") return "page";
  const parts = rel.split("/").slice(0, -1);
  const isLayout = rel.endsWith("/layout.tsx");
  const selfWraps = isLayout && readFileSync(file, "utf8").includes("<ClientMessages");
  for (let depth = parts.length; depth > 0; depth -= 1) {
    if (isLayout && !selfWraps && depth === parts.length) continue;
    const key = `${parts.slice(0, depth).join("/")}/layout`;
    if (key in CLIENT_NAMESPACES) return key;
  }
  return null;
}

describe("client message namespaces (V2-15)", () => {
  it("finds the route files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("every client component finds its text: what a route needs is sent to it", () => {
    for (const file of files) {
      const wrapper = wrapperOf(file);
      const sent = new Set<string>(wrapper ? CLIENT_NAMESPACES[wrapper as keyof typeof CLIENT_NAMESPACES] : ROOT_NAMESPACES);
      const missing = [...needs(file)].filter((name) => !sent.has(name));
      expect(missing, `${relative(file)} uses ${missing.join(", ")} but it is not sent (i18n/client-messages.ts)`).toEqual([]);
    }
  });

  it("nothing is sent that no client component uses", () => {
    const used = new Map<string, Set<string>>();
    for (const file of files) {
      const wrapper = wrapperOf(file) ?? "root";
      const set = used.get(wrapper) ?? new Set<string>();
      needs(file).forEach((name) => set.add(name));
      used.set(wrapper, set);
    }
    expect([...ROOT_NAMESPACES].sort(), "root").toEqual([...(used.get("root") ?? [])].sort());
    for (const [key, names] of Object.entries(CLIENT_NAMESPACES)) {
      expect([...names].sort(), key).toEqual([...(used.get(key) ?? [])].sort());
    }
  });

  it("each listed wrapper really wraps its section", () => {
    for (const key of Object.keys(CLIENT_NAMESPACES)) {
      const file = key === "page" ? path.join(APP, "page.tsx") : path.join(APP, `${key}.tsx`);
      expect(existsSync(file), `${key}`).toBe(true);
      expect(readFileSync(file, "utf8"), `${key}`).toContain(`route="${key}"`);
    }
  });

  it("every namespace named exists in both languages", () => {
    const names = new Set([...ROOT_NAMESPACES, ...Object.values(CLIENT_NAMESPACES).flat()]);
    for (const language of ["tr", "en"]) {
      const dir = path.join(ROOT, "messages", language);
      const top = new Set(readdirSync(dir).flatMap((name) => Object.keys(JSON.parse(readFileSync(path.join(dir, name), "utf8")))));
      for (const name of names) expect(top.has(name), `${name} in ${language}`).toBe(true);
    }
  });
});
