/**
 * תמונת שיתוף לוואטסאפ: רקע סולאר (1200×630) + לוגו שקוף בלבד — ללא עיגול/הילה כהה מאחור.
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

const W = 1200;
const H = 630;

const hero = await sharp(heroPath).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();

const logoSize = Math.round(Math.min(W, H) * 0.38);
const marginTop = Math.round(H * 0.045);
const logoLeft = Math.round((W - logoSize) / 2);
const logoTop = marginTop;

const logo = await sharp(logoPath)
  .ensureAlpha()
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const out = await sharp(hero)
  .composite([{ input: logo, top: logoTop, left: logoLeft }])
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

await fs.writeFile(outPath, out);
console.log(`Wrote ${outPath} (${W}x${H}) ${out.length} bytes — logo only (no halo)`);
