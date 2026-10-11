import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { buildCsp } from "./lib/csp";

const handleI18n = createMiddleware(routing);

// Language routing, plus a Content-Security-Policy with a fresh nonce for every request
// (BACKLOG Y30; Next applies the nonce to its own scripts when it sees the policy on the request).
export default function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = handleI18n(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip Next internals, the generated icon and share image, and any path with a file extension
  // (logos, fonts), which are served without a language.
  matcher: "/((?!api|_next|_vercel|apple-icon|opengraph-image|.*\\..*).*)",
};
