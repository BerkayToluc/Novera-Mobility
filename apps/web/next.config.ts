import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The headers every response carries (BACKLOG Y30). The Content-Security-Policy is not here: it
// needs a new nonce per request, so proxy.ts sets it.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kept for browsers that predate `frame-ancestors` in the policy.
  { key: "X-Frame-Options", value: "DENY" },
  // The site uses none of these; denying them keeps an embedded script from asking.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Two years, subdomains included. Browsers ignore it on plain http, so it is harmless on
  // localhost, but it is only sent in production to avoid pinning a development host.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The browser calls /api/..., and Next forwards it to the NestJS API (ARCHITECTURE
  // ADR-14). To the browser the API is the same site, so the httpOnly session cookie is a
  // first-party cookie: no CORS and no `SameSite=None`. `/api` is dropped before the
  // request reaches the API, so its routes need no prefix.
  async rewrites() {
    const apiUrl = process.env.API_URL;
    // Unset in a checkout that only works on the frontend: /api then simply 404s.
    if (!apiUrl) return [];
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
