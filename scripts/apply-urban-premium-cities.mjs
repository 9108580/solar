/**
 * מריץ supabase/urban_premium_cities.sql על הפרויקט המקושר (Supabase CLI + login).
 *
 * שימוש: npm run db:apply:urban-cities
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'supabase', 'urban_premium_cities.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('✗ חסר:', sqlPath);
  process.exit(1);
}

const r = spawnSync(
  'npx',
  ['--yes', 'supabase@2', 'db', 'query', '--linked', '-f', sqlPath],
  { cwd: root, stdio: 'inherit', shell: true }
);

if (r.status !== 0) {
  console.error('\n✗ הרצת SQL נכשלה. ודאו: npx supabase login + npx supabase link --project-ref ffcdkpecozxkxcekeywp');
  process.exit(r.status ?? 1);
}

const verify = spawnSync(
  'npx',
  [
    '--yes',
    'supabase@2',
    'db',
    'query',
    '--linked',
    'select count(*)::int as n from public.urban_premium_cities;',
  ],
  { cwd: root, encoding: 'utf8', shell: true }
);

if (verify.status === 0) {
  const out = (verify.stdout || '') + (verify.stderr || '');
  const m = out.match(/\b68\b/) || out.match(/"n"\s*:\s*68/);
  console.log(m ? '\n✓ urban_premium_cities: 68 יישובים בבסיס.' : '\n✓ SQL הושלם (בדקו count ב-Supabase).');
} else {
  console.log('\n✓ SQL הושלם.');
}
