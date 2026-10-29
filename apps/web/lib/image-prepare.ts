import { MAX_UPLOAD_BYTES, targetWidth, WEBP_QUALITY } from "./image-rules";

// What the browser does with a picture before it is sent (ARCHITECTURE ADR-28): it is made at most 2000 px wide and turned into
// WebP, which is usually a few hundred KB. That is what lets a 5 MB phone photo through a request that may not be over 4 MB
// (lib/image-rules.ts), and it turns the picture the right way up on the way. It is a help, not a check: the server opens
// what arrives and decides again, so a browser that cannot do this (or a caller that does not use the browser) loses nothing
// but the saving.
export type Prepared = {
  file: File;
  // The width the picture has once the right way up and as it will be sent, or `null` when the browser could not read it.
  width: number | null;
};

const stem = (name: string) => name.replace(/\.[^.]*$/, "") || "foto";

export async function prepareImage(file: File): Promise<Prepared> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    const wanted = targetWidth(width);
    // A picture that is small enough is sent as it is: no second round of compression for nothing.
    if (wanted === width && file.size <= MAX_UPLOAD_BYTES / 2) {
      bitmap.close();
      return { file, width };
    }
    const canvas = document.createElement("canvas");
    canvas.width = wanted;
    canvas.height = Math.max(1, Math.round((height * wanted) / width));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { file, width };
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY / 100));
    // A browser that cannot write WebP answers with PNG; that is no smaller, so the original is kept.
    if (!blob || blob.type !== "image/webp") return { file, width };
    return { file: new File([blob], `${stem(file.name)}.webp`, { type: "image/webp" }), width: wanted };
  } catch {
    // Not a picture the browser can open (a PDF with a picture's name, a damaged file): the server will say what it is.
    return { file, width: null };
  }
}
