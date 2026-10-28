// Re-encodes fleet photos that are over the size budget (V2-21, QUALITY P-03): at most ~120 KB per model.
// Usage: node scripts/shrink-photos.mjs [file ...]   (default: every WebP in public/fleet that is over budget)
// It only ever makes a file smaller and keeps the 1280x800 (16:10) size, so the layout does not change.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(import.meta.dirname, "..", "public", "fleet");
const BUDGET = 120 * 1024;

const names = process.argv.slice(2).length ? process.argv.slice(2) : (await readdir(DIR)).filter((f) => f.endsWith(".webp"));

for (const name of names) {
  const file = path.join(DIR, name);
  const original = await readFile(file);
  if (original.length <= BUDGET) continue;
  // Highest quality that fits the budget; smartSubsample keeps edges (car outlines) clean.
  let best = original;
  for (let quality = 80; quality >= 40; quality -= 5) {
    const out = await sharp(original).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    best = out;
    if (out.length <= BUDGET) break;
  }
  if (best.length < original.length) {
    await writeFile(file, best);
    console.log(`${name}: ${Math.round(original.length / 1024)} KB -> ${Math.round(best.length / 1024)} KB`);
  }
}
