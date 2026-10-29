"use server";

import { randomUUID } from "node:crypto";
import type { UploadResult } from "./admin-upload";
import { processImage } from "./image-process";
import { MAX_UPLOAD_BYTES } from "./image-rules";
import { isMockMode } from "./mode";
import { getSession } from "./session";

// The photo of a vehicle model, from the panel to the photo store (ARCHITECTURE ADR-28). The browser sends the file to this
// action, not to the store: here it is checked and made (lib/image-process.ts), and only then written. The store's key
// (BLOB_READ_WRITE_TOKEN, or the credentials Vercel gives the project) is read here and nowhere else, and never reaches the browser.
// Only the address of the stored picture goes back, and the model's form hands that to the API, which accepts only an address
// on this store (apps/api/src/common/image-url.ts).
const STORE_HOST_SUFFIX = ".public.blob.vercel-storage.com";

// Written to the store under a name nobody chose: a random one, in a folder of its own, so a file name sent by the browser
// (which can say anything) is never used.
async function writeToStore(webp: Buffer): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(`vehicle-models/${randomUUID()}.webp`, webp, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
  });
  // The address that comes back has to be one the site will show and the API will accept; anything else means the store is
  // not the one this was set up for, and it is better to stop here than to hand it on.
  if (new URL(blob.url).protocol !== "https:" || !new URL(blob.url).hostname.endsWith(STORE_HOST_SUFFIX)) {
    throw new Error("The photo store answered with an address that is not its own");
  }
  return blob.url;
}

export async function uploadVehicleImage(formData: FormData): Promise<UploadResult> {
  // Who is asking, as the API says (GET /me → role): the panel's pages are only a convenience, an action is a public address.
  if ((await getSession())?.role !== "admin") return { status: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { status: "unreadable" };
  // Checked on the size the browser states before the file is read into memory; `processImage` checks the real size again.
  if (file.size > MAX_UPLOAD_BYTES) return { status: "too_large" };

  const processed = await processImage(Buffer.from(await file.arrayBuffer()));
  if (processed.status !== "ok") return { status: processed.status };

  try {
    const url = isMockMode() ? (await import("@/mocks/uploads")).putMockUpload(processed.webp) : await writeToStore(processed.webp);
    return { status: "ok", url, width: processed.width, height: processed.height };
  } catch {
    // Nothing of the failure is passed on (it can name the store); the person is told to try again.
    return { status: "unavailable" };
  }
}
