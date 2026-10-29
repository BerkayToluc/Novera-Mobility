// The rules for a picture the panel uploads (ARCHITECTURE ADR-28, ADMIN.md §3.1). Shared by the browser (which prepares and
// checks the file at once) and the server (which checks again and decides: nothing the browser says is trusted).
//
// Two sizes, because two things limit them:
// - a person may choose a file of up to 5 MB, the rule of the product (a phone photo is often 3 to 8 MB);
// - what is SENT to the server is at most 4 MB: Vercel Functions refuse a request body over 4.5 MB, and a Server Action's own
//   limit is raised to match in next.config.ts. So the browser first makes the picture smaller (at most 2000 px wide, WebP),
//   which is usually a few hundred KB, and the server makes it smaller still the same way.
export const MAX_PICK_MB = 5;
export const MAX_PICK_BYTES = MAX_PICK_MB * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MIN_WIDTH = 1200;
export const MAX_WIDTH = 2000;
export const WEBP_QUALITY = 82;
// Pixels a picture may have when it is opened (a decompression bomb is a tiny file with billions of pixels).
export const MAX_PIXELS = 60_000_000;

export const ACCEPT = "image/jpeg,image/png,image/webp";

export type ImageKind = "jpeg" | "png" | "webp";

// The kind of a picture from its first bytes, never from the name or the type the browser reported (ADR-28): a PDF renamed
// `.jpg` is not a picture. `null` for anything else.
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  // WebP is RIFF, a size, then "WEBP".
  if (
    bytes.length >= 12 &&
    [0x52, 0x49, 0x46, 0x46].every((byte, index) => bytes[index] === byte) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[8 + index] === byte)
  ) {
    return "webp";
  }
  return null;
}

// The width a picture is made, from the width it has: never larger than it was (a small picture is not stretched), never more
// than the most the site shows.
export const targetWidth = (width: number): number => Math.min(width, MAX_WIDTH);
