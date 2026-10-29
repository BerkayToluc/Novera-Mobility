import sharp from "sharp";
import { MAX_PIXELS, MAX_UPLOAD_BYTES, MAX_WIDTH, MIN_WIDTH, sniffImage, WEBP_QUALITY } from "./image-rules";

// What the server does with a picture that was sent to it (ARCHITECTURE ADR-28): look at what it really is, refuse what is not
// a picture or is too small, and make the one that is accepted the same way every time: the right way up, at most 2000 px
// wide, WebP, with everything the camera wrote into it (position, time, the camera itself) left out. Separate from the
// action that stores it, so it is tested with pictures made on the spot.
export type ProcessResult =
  | { status: "ok"; webp: Buffer; width: number; height: number }
  | { status: "too_large" | "wrong_type" | "too_narrow" | "unreadable" };

export async function processImage(input: Buffer): Promise<ProcessResult> {
  if (input.length > MAX_UPLOAD_BYTES) return { status: "too_large" };
  if (sniffImage(input) === null) return { status: "wrong_type" };

  try {
    // `rotate()` with no argument turns the picture the way its orientation mark says and drops the mark. A WebP is written
    // without metadata unless it is asked for, so nothing of the original's EXIF, ICC or XMP is carried over.
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    // Measured on what comes out: a picture is as wide as it is once the right way up, and never stretched, so a narrow one stays narrow.
    if (info.width < MIN_WIDTH) return { status: "too_narrow" };
    return { status: "ok", webp: data, width: info.width, height: info.height };
  } catch {
    // Corrupt, cut short, or more pixels than allowed: the file looked like a picture but cannot be read as one.
    return { status: "unreadable" };
  }
}
