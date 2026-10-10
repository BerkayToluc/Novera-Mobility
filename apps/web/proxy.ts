import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals, the generated icon and share image, and any path with a file extension
  // (logos, fonts), which are served without a language.
  matcher: "/((?!api|_next|_vercel|apple-icon|opengraph-image|.*\\..*).*)",
};
