import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'tmp-docx-extract', 'word', 'media');
const destDir = path.join(root, 'public', 'project-examples');

const { default: sharp } = await import('sharp');

if (!fs.existsSync(srcDir)) {
  console.error('Missing extracted docx media at', srcDir);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter((f) => /\.png$/i.test(f)).sort();

for (let i = 0; i < files.length; i++) {
  const out = path.join(destDir, `project-${String(i + 1).padStart(2, '0')}.jpg`);
  await sharp(path.join(srcDir, files[i]))
    .rotate()
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${files[i]} -> ${path.basename(out)} (${kb} KB)`);
}

console.log(`Done: ${files.length} images in public/project-examples/`);
