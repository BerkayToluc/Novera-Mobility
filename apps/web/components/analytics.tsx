import { headers } from "next/headers";
import { getConsent } from "@/lib/get-consent";

// The analytics script (ARCHITECTURE ADR-19): a cookieless tool (Umami), written into the page
// only when the visitor said yes and the site has one set up. Without consent the tag is not in
// the HTML at all, so nothing is requested from the analytics host.
//
// `ANALYTICS_SCRIPT_URL` is the address of the tool's script and `ANALYTICS_WEBSITE_ID` the id it
// gives the site; both empty in development and previews, which switches analytics off.
export async function Analytics() {
  const src = process.env.ANALYTICS_SCRIPT_URL;
  const websiteId = process.env.ANALYTICS_WEBSITE_ID;
  if (!src || !websiteId) return null;
  if (!(await getConsent())?.analytics) return null;

  // The page's Content-Security-Policy only lets scripts with its nonce run (proxy.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script defer src={src} data-website-id={websiteId} nonce={nonce} />;
}
