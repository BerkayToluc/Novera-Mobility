// Re-encodes fleet photos that are over the size budget (V2-21, QUALITY P-03): at most ~120 KB per model.
// Usage: node scripts/shrink-photos.mjs [file ...]   (default: every WebP in public/fleet that is over budget)
// It only ever makes a file smaller. Quality comes down first (to 60, below that edges start to smear); if the budget is
// still missed the width steps down (16:10 is kept, so the layout does not change; the site never serves more than 1280 px).
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
  fit: for (const width of [1280, 1120, 960]) {
    const source = sharp(original).resize({ width, height: Math.round((width * 10) / 16), fit: "cover" });
    for (let quality = 80; quality >= 60; quality -= 5) {
      best = await source.clone().webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      if (best.length <= BUDGET) break fit;
    }
  }
  if (best.length < original.length) {
    await writeFile(file, best);
    console.log(`${name}: ${Math.round(original.length / 1024)} KB -> ${Math.round(best.length / 1024)} KB`);
  }
}
