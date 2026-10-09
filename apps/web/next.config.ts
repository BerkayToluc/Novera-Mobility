import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
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
