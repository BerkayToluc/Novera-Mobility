import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { assertMockModeAllowed } from "./lib/mode";

// Runs on `next build` and on `next start`: stops here if the sample data mode is on where it must not be (ADR-29).
assertMockModeAllowed();

// The headers every response carries (BACKLOG Y30). The Content-Security-Policy is not here: it
// needs a new nonce per request, so proxy.ts sets it.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kept for browsers that predate `frame-ancestors` in the policy.
  { key: "X-Frame-Options", value: "DENY" },
  // The site uses none of these; denying them keeps an embedded script from asking.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  // Two years, subdomains included. Browsers ignore it on plain http, so it is harmless on
  // localhost, but it is only sent in production to avoid pinning a development host.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

// The photo store the panel uploads to (ADR-28): the site shows pictures from it through next/image, which has to be told the
// host. Only the folder the panel writes to, and only the store family's public host.
const PHOTO_STORE = "*.public.blob.vercel-storage.com";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: PHOTO_STORE, pathname: "/vehicle-models/**" }] },
  // A photo is sent to a Server Action (ADR-28). The default limit is 1 MB; the largest thing sent is 4 MB (the browser makes the
  // picture smaller first, lib/image-rules.ts) plus the few KB multipart adds, and Vercel Functions refuse a body over 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // No `/api` rewrite: the browser never calls the API (ARCHITECTURE ADR-14); every call goes from the server.
  // A rewrite would only have made the API reachable through the site's own address (QUALITY G-08).
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
