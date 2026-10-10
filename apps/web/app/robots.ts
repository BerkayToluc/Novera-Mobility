import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Only the API is closed to crawlers. Account, booking and search pages are not listed here on
// purpose: robots.txt stops a crawler from fetching a page, and a page it cannot fetch is a page
// whose "noindex" it never reads, so the address could still be indexed from a link elsewhere
// (ARCHITECTURE ADR-18). Those pages carry noindex in their own metadata instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
