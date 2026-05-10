/**
 * מושך את שורת ההגדרות (מחירונים, ממירים, סוכנים…) מ-Supabase כמו בפרודקשן.
 *
 * שימוש:
 *   1) העתיקו מ-Vercel את REACT_APP_SUPABASE_URL ו-REACT_APP_SUPABASE_ANON_KEY ל-.env.local בפרויקט
 *   2) npm run pull:admin
 *
 * נוצר הקובץ admin-settings-from-cloud.json (לא ל-commit — ב-.gitignore).
 *
 * אחר כך: npm start — עם אותם משתני סביבה האפליקציה נטענת מהענן אוטומטית.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadDotEnvFile(fileName) {
  const p = path.join(root, fileName);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadDotEnvFile('.env.local');
loadDotEnvFile('.env');

const url = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error(
    'Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY.\n' +
      'Copy them from Vercel → Project → Settings → Environment Variables into .env.local at the repo root, then run again.'
  );
  process.exit(1);
}

const endpoint = `${url}/rest/v1/admin_settings?select=payload,updated_at&id=eq.1`;

const res = await fetch(endpoint, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`HTTP ${res.status}`, body);
  process.exit(1);
}

const rows = await res.json();
const row = Array.isArray(rows) ? rows[0] : null;

if (!row || row.payload == null) {
  console.error('No admin_settings row with id=1, or payload is empty. Open Supabase Table Editor and confirm data exists.');
  process.exit(1);
}

const out = {
  fetchedAt: new Date().toISOString(),
  updated_at: row.updated_at ?? null,
  payload: row.payload,
};

const outPath = path.join(root, 'admin-settings-from-cloud.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

console.log(`Saved: ${outPath}`);
console.log(
  '\nNext:\n' +
    '  • Easiest: keep the same vars in .env.local and run `npm start` — the app loads this payload from Supabase on startup.\n' +
    '  • Backup only: the JSON file is a snapshot; do not commit it (gitignored).'
);
