/**
 * בונה public/og-quote-share.png — תמונת שיתוף לוואטסאפ עם לוגו החברה.
 * הרצה: node scripts/build-og-quote-share.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const W = 1200;
const H = 630;
const plateSize = 200;
const logoSize = 168;
const margin = 36;
const plateLeft = W - margin - plateSize;
const plateTop = margin;
const logoLeft = plateLeft + Math.round((plateSize - logoSize) / 2);
const logoTop = plateTop + Math.round((plateSize - logoSize) / 2);

const heroPath = path.join(publicDir, 'hero-solar-rooftop.png');
const logoPath = path.join(publicDir, 'brand-logo.png');
const outPath = path.join(publicDir, 'og-quote-share.png');

const hero = await sharp(heroPath).resize(W, H, { fit: 'cover', position: 'center' }).toBuffer();

const logo = await sharp(logoPath)
  .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer();

const overlaySvg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect x="${plateLeft}" y="${plateTop}" width="${plateSize}" height="${plateSize}" rx="22" fill="#ffffff" fill-opacity="0.96"/>
  </svg>`
);

await sharp(hero)
  .composite([
    { input: overlaySvg, top: 0, left: 0 },
    { input: logo, top: logoTop, left: logoLeft },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`Wrote ${outPath} (${W}x${H})`);
