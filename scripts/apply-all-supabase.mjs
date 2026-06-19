/**
 * מריץ את כל קבצי ה-SQL הנדרשים לפרויקט הצעות מחיר (סכימה, Storage, ניקוי טריגרים).
 *
 * סדר עדיפות:
 *   1) DATABASE_URL / SUPABASE_DB_PASSWORD + REACT_APP_SUPABASE_URL (pg)
 *   2) Supabase CLI מקושר: npx supabase db query --linked -f …
 *
 * שימוש: npm run db:apply:all
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
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

const SQL_FILES = [
  'schema.sql',
  'shared_quotes.sql',
  'extend_shared_quotes_ttl_90_days.sql',
  'admin_assets_storage.sql',
  'urban_premium_cities.sql',
  'remove_admin_settings_history.sql',
];

function runViaSupabaseCli(file) {
  const sqlPath = path.join(root, 'supabase', file);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const tmpFile = path.join(os.tmpdir(), `supabase-apply-${file.replace(/[^\w.-]/g, '_')}`);
  try {
    fs.writeFileSync(tmpFile, sql, 'utf8');
    const r = spawnSync(
      'npx',
      ['--yes', 'supabase@2', 'db', 'query', '--linked', '-f', tmpFile],
      { cwd: root, stdio: 'pipe', encoding: 'utf8', shell: true }
    );
    if (r.status !== 0) {
      const err = (r.stderr || r.stdout || '').trim();
      throw new Error(err || `supabase db query failed for ${file}`);
    }
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  console.log('→ אין DATABASE_URL — מריצים דרך Supabase CLI (פרויקט מקושר)…\n');
  try {
    for (const file of SQL_FILES) {
      const sqlPath = path.join(root, 'supabase', file);
      if (!fs.existsSync(sqlPath)) {
        console.warn(`⚠ דילוג — חסר: ${file}`);
        continue;
      }
      process.stdout.write(`→ ${file} … `);
      runViaSupabaseCli(file);
      console.log('✓');
    }
    console.log('\n✓ כל מיגרציות Supabase הושלמו (CLI).');
  } catch (e) {
    console.error('\n✗ שגיאה:', e.message || e);
    console.error('  ודאו: npx supabase login && npx supabase link --project-ref ffcdkpecozxkxcekeywp');
    console.error('  או הוסיפו ל-.env.local: SUPABASE_DB_PASSWORD (מ-Settings → Database) והריצו שוב.');
    process.exit(1);
  }
  process.exit(0);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const file of SQL_FILES) {
    const sqlPath = path.join(root, 'supabase', file);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`⚠ דילוג — חסר: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    process.stdout.write(`→ ${file} … `);
    await client.query(sql);
    console.log('✓');
  }
  console.log('\n✓ כל מיגרציות Supabase הושלמו.');
} catch (e) {
  console.error('\n✗ שגיאה:', e.message || e);
  if (e.code) console.error('  קוד:', e.code);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
