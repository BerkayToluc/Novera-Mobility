import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals and any path with a file extension (logos, fonts),
  // which are served from /public and have no language.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
