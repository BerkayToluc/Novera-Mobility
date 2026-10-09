// The address the site is served from, for absolute links (sitemap, share previews).
// Set NEXT_PUBLIC_SITE_URL in production; the local address is only a development default.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
