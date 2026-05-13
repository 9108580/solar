/**
 * מריץ את supabase/shared_quotes.sql מול Postgres של Supabase (DDL + פונקציה).
 *
 * דרישה: סיסמת מסד הנתונים של הפרויקט (לא מפתח anon).
 *
 * אחת מהאפשרויות:
 *   A) DATABASE_URL או SUPABASE_DB_URL — מחרוזת החיבור המלאה מ-Supabase → Settings → Database → URI
 *   B) REACT_APP_SUPABASE_URL (כבר ב-.env.local) + SUPABASE_DB_PASSWORD — הסיסמה של משתמש postgres
 *
 * שימוש: npm run db:apply:shared-quotes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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

function resolveDatabaseUrl() {
  let u = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (u) return u.trim();

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !pw) return null;

  let host;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
  const ref = host.split('.')[0];
  if (!ref) return null;

  const encoded = encodeURIComponent(pw);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error(`
לא נמצא חיבור למסד הנתונים.

הוסיפו ל-.env.local אחת מהאפשרויות:
  1) DATABASE_URL=<מחרוזת מלאה מ-Supabase → Project Settings → Database → Connection string → URI>
  או
  2) SUPABASE_DB_PASSWORD=<סיסמת postgres של הפרויקט>
     (יחד עם REACT_APP_SUPABASE_URL שכבר קיים)

אחר כך: npm run db:apply:shared-quotes
`);
  process.exit(1);
}

const sqlPath = path.join(root, 'supabase', 'shared_quotes.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('חסר קובץ:', sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('✓ הושלם: supabase/shared_quotes.sql הורץ בהצלחה.');
} catch (e) {
  console.error('✗ שגיאה בהרצת SQL:', e.message || e);
  if (e.code) console.error('  קוד:', e.code);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
