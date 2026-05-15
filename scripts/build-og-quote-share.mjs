/**
 * בונה public/og-quote-share.png — תמונת הגג המקורית + לוגו שקוף מעל (בלי רקע לבן).
 * הרצה: node scripts/build-og-quote-share.mjs
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const heroPath = path.join(publicDir, 'hero-solar-rooftop.png');
const logoPath = path.join(publicDir, 'brand-logo.png');
const outPath = path.join(publicDir, 'og-quote-share.png');

const heroMeta = await sharp(heroPath).metadata();
const W = heroMeta.width || 1024;
const H = heroMeta.height || 576;

const logoSize = Math.round(Math.min(W, H) * 0.2);
const margin = Math.round(Math.min(W, H) * 0.035);

const logo = await sharp(logoPath)
  .ensureAlpha()
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const out = await sharp(heroPath)
  .composite([{ input: logo, top: margin, left: margin }])
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

await fs.writeFile(outPath, out);
console.log(`Wrote ${outPath} (${W}x${H}) ${out.length} bytes`);
