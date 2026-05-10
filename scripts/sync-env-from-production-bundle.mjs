/**
 * Pulls public Supabase URL + anon key from the deployed CRA bundle (same as browser sees).
 * Writes .env.local so local dev and npm run pull:admin match production backend.
 *
 * Usage: node scripts/sync-env-from-production-bundle.mjs [pageUrl]
 * Default pageUrl: https://www.mes.bet/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pageUrl = process.argv[2] || 'https://www.mes.bet/';

const htmlRes = await fetch(pageUrl, { redirect: 'follow' });
if (!htmlRes.ok) throw new Error(`Fetch HTML ${htmlRes.status}`);
const html = await htmlRes.text();
const m = html.match(/src="(\/static\/js\/main\.[a-f0-9]+\.js)"/);
if (!m) throw new Error('Could not find main.*.js in HTML');
const base = new URL(pageUrl);
const jsUrl = new URL(m[1], base).href;
const jsRes = await fetch(jsUrl);
if (!jsRes.ok) throw new Error(`Fetch bundle ${jsRes.status}`);
const bundle = await jsRes.text();

/** Minified pattern: …"https://xxx.supabase.co",$n="eyJ…anon…" */
const urlMatch = bundle.match(/"(https:\/\/[a-z0-9-]+\.supabase\.co)"/);
if (!urlMatch) throw new Error('Supabase URL not found in bundle');
const afterUrl = bundle.slice(urlMatch.index + urlMatch[0].length);
const keyMatch = afterUrl.match(/="(eyJ[^"]+)"/);
if (!keyMatch) throw new Error('Supabase anon key not found after URL in bundle');

const envPath = path.join(root, '.env.local');
const lines = [
  '# Synced from production JS bundle (public anon key — same values the live site uses)',
  `REACT_APP_SUPABASE_URL="${urlMatch[1]}"`,
  `REACT_APP_SUPABASE_ANON_KEY="${keyMatch[1]}"`,
  '',
];

fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(root, envPath)}`);
console.log(`Supabase URL: ${urlMatch[1]}`);
console.log('Pull admin snapshot: npm run pull:admin');
console.log('Local dev: npm start');
