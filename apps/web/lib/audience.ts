// The home page serves two audiences (SPEC §2.2). The choice lives in the URL
// (/?tip=kurumsal) so a shared link opens the same tab; anything else means individual.
export const AUDIENCES = ["bireysel", "kurumsal"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const DEFAULT_AUDIENCE: Audience = "bireysel";

export function parseAudience(value: string | string[] | undefined): Audience {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "kurumsal" ? "kurumsal" : DEFAULT_AUDIENCE;
}
