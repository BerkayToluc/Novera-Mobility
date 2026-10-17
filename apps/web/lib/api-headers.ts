import "server-only";
import { headers } from "next/headers";

// What every call from the web server to the API carries besides its own content (docs/DEPLOY.md, docs/SECURITY.md):
// - X-Novera-Key: the secret shared with the API (API_ACCESS_KEY). In production the API answers 404 to a
//   call without it, so only this server can use it.
// - X-Novera-Client-IP: the visitor's address. The API limits sign-ins and forms per address, and from here
//   it would otherwise see only this server. It believes the header only when the key above matched.
// The first entry of `X-Forwarded-For` is the visitor's address on Vercel, which overwrites the header and
// so cannot be forged; `X-Real-IP` is the fallback.
export async function apiHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const visitor = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip")?.trim();
  const key = process.env.API_ACCESS_KEY?.trim();
  return {
    ...(key ? { "X-Novera-Key": key } : {}),
    ...(visitor ? { "X-Novera-Client-IP": visitor } : {}),
  };
}
