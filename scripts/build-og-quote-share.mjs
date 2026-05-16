/**
 * בונה public/og-quote-share.png — תמונת הגג + לוגו שקוף (גדול יותר, פינה עליונה‑ימנית
 * כדי שלא ייחתך בתצוגת קישור בוואטסאפ) + הילה כהה עדינה מאחורי הלוגו בלבד.
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

const logoSize = Math.round(Math.min(W, H) * 0.32);
const margin = Math.round(Math.min(W, H) * 0.04);
const logoLeft = W - logoSize - margin;
const logoTop = margin;
const cx = logoLeft + logoSize / 2;
const cy = logoTop + logoSize / 2;
const haloR = logoSize * 0.58;

const haloSvg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${haloR}" ry="${haloR}" fill="rgba(0,0,0,0.42)"/>
  </svg>`
);

const logo = await sharp(logoPath)
  .ensureAlpha()
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const out = await sharp(heroPath)
  .composite([
    { input: haloSvg, top: 0, left: 0 },
    { input: logo, top: logoTop, left: logoLeft },
  ])
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

await fs.writeFile(outPath, out);
console.log(`Wrote ${outPath} (${W}x${H}) ${out.length} bytes — logo top-right`);
