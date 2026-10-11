// The rental guides of SPEC §2.9. Slugs are the URL segment and the message keys under
// "GuidesPage.items"; adding a guide means one entry here plus its text in both message files.
export const GUIDES = [
  "gerekli-belgeler",
  "farkli-bayiye-iade",
  "hasar-ve-ariza",
  "elektrikli-arac-rehberi",
  "kurumsal-kiralama-rehberi",
  "dogru-arac-secimi",
] as const;

export type GuideSlug = (typeof GUIDES)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDES as readonly string[]).includes(value);
}

export type GuideSection = { heading: string; paragraphs: string[] };
