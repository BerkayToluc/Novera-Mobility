// The Content-Security-Policy of the site (BACKLOG Y30), built per request because the script
// nonce is new each time. What each part allows, and why:
//
// - scripts: only the ones that carry this request's nonce (and what they load, `strict-dynamic`),
//   which is how Next's own scripts, the analytics tag and the Google Maps loader run;
// - styles: the site's own and inline ones. A nonce is not used for styles because Google Maps
//   adds style tags of its own; style attributes (`style="…"`) are used by a few components;
// - images, connections and workers: the site itself, plus Google Maps and the analytics host;
// - frames: only Google's sign-in button.
const GOOGLE_MAPS = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
// Google Identity Services, the sign-in button: its script, the frame the button and the account chooser
// live in, the calls it makes, and its stylesheet.
const GOOGLE_SIGNIN = "https://accounts.google.com";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const analytics = originOf(process.env.ANALYTICS_SCRIPT_URL);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only, to rebuild server stack traces in the browser.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", `${GOOGLE_SIGNIN}/gsi/client`, ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", `${GOOGLE_SIGNIN}/gsi/style`],
    "img-src": ["'self'", "data:", "blob:", ...GOOGLE_MAPS, "https://*.googleapis.com", "https://*.ggpht.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...GOOGLE_MAPS, GOOGLE_SIGNIN, ...(analytics ? [analytics] : [])],
    "worker-src": ["'self'", "blob:"],
    "frame-src": [GOOGLE_SIGNIN],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only meaningful over https; localhost development is plain http.
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
