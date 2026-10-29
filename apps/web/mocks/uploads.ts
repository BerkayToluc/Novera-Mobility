import { randomUUID } from "node:crypto";

// The sample photo store (USE_MOCKS=1, local work and tests only, lib/mode.ts): what the panel uploads in sample mode is kept in
// the memory of the server and served at `/mock-uploads/<name>.webp` (app/mock-uploads/[name]/route.ts), standing in for the
// photo store. Kept on `globalThis` so the action that stores and the route that serves share it however Next splits the
// modules, and trimmed to the latest few so a test run cannot grow the server without end.
const MAX_KEPT = 60;
const store = globalThis as typeof globalThis & { __noveraMockUploads?: Map<string, Buffer> };
const pictures = (): Map<string, Buffer> => (store.__noveraMockUploads ??= new Map());

export function putMockUpload(webp: Buffer): string {
  const all = pictures();
  const name = `${randomUUID()}.webp`;
  all.set(name, webp);
  if (all.size > MAX_KEPT) {
    const oldest = all.keys().next().value;
    if (oldest !== undefined) all.delete(oldest);
  }
  return `/mock-uploads/${name}`;
}

export function getMockUpload(name: string): Buffer | null {
  return pictures().get(name) ?? null;
}
