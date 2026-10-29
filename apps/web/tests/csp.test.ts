import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp } from "@/lib/csp";

afterEach(() => vi.unstubAllEnvs());

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  it("lets only scripts with this request's nonce run", () => {
    const script = directive(buildCsp("abc123"), "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("allows eval in development only", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(directive(buildCsp("n"), "script-src")).toContain("'unsafe-eval'");
    expect(buildCsp("n")).not.toContain("upgrade-insecure-requests");
  });

  it("forbids framing, plugins and foreign form targets", () => {
    const csp = buildCsp("n");
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "form-action")).toBe("'self'");
    expect(directive(csp, "base-uri")).toBe("'self'");
  });

  it("lets the page talk to the analytics host only when one is set", () => {
    expect(directive(buildCsp("n"), "connect-src")).not.toContain("analytics.example");
    vi.stubEnv("ANALYTICS_SCRIPT_URL", "https://analytics.example/script.js");
    expect(directive(buildCsp("n"), "connect-src")).toContain("https://analytics.example");
  });

  it("ignores an analytics address that is not a URL", () => {
    vi.stubEnv("ANALYTICS_SCRIPT_URL", "not a url");
    expect(directive(buildCsp("n"), "connect-src")).toBe("'self' https://maps.googleapis.com https://maps.gstatic.com https://accounts.google.com");
  });
});

describe("buildCsp: the photo store (V2-28)", () => {
  it("lets pictures load from the store's public domain when no host is named", () => {
    expect(directive(buildCsp("n"), "img-src")).toContain("https://*.public.blob.vercel-storage.com");
  });

  it("names only our own store once it is set, and never widens to the family", () => {
    vi.stubEnv("BLOB_PUBLIC_HOST", "ce0rcu23vrrdzqap.public.blob.vercel-storage.com");
    const images = directive(buildCsp("n"), "img-src");
    expect(images).toContain("https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com");
    expect(images).not.toContain("https://*.public.blob.vercel-storage.com");
  });

  it("ignores a host that is not a plain host name instead of putting it into the policy", () => {
    for (const bad of ["evil.com; script-src *", "https://x.com", "a b", "*.com", ""]) {
      vi.stubEnv("BLOB_PUBLIC_HOST", bad);
      const csp = buildCsp("n");
      expect(directive(csp, "img-src")).toContain("https://*.public.blob.vercel-storage.com");
      expect(csp).not.toContain("script-src *");
    }
  });

  it("does not open connections or scripts to the store", () => {
    const csp = buildCsp("n");
    expect(directive(csp, "connect-src")).not.toContain("blob.vercel-storage.com");
    expect(directive(csp, "script-src")).not.toContain("blob.vercel-storage.com");
  });
});
