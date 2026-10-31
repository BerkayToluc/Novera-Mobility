// The simulated data of the fleet panel (ADR-30) changes every five minutes, not on every request: the same moment gives the same answer, so
// a test can pin it and no telemetry table grows in the database. A "slice" is the number of the five minutes an instant is in.
export const SLICE_MS = 5 * 60 * 1000;

export const sliceOf = (at: Date): number => Math.floor(at.getTime() / SLICE_MS);
export const sliceStart = (slice: number): Date => new Date(slice * SLICE_MS);

// A number in [0, 1) that depends only on the key and the slice: FNV-1a over the text, then mulberry32. Not secret and not random; it is the
// same for everybody who asks about the same thing at the same time.
export function seeded(key: string, slice: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${key}|${slice}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  let t = (hash >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
