#!/usr/bin/env node
/**
 * Prints Render env var values from local credential files (for dashboard paste).
 * Run: node scripts/export-render-secrets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJsonFile(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8').trim();
}

const vars = {
  PERSIK_SERVER: '1',
  AUTO_PRINT_INVOICES: 'false',
  PERSIK_AUTH_USER: 'mes',
  PERSIK_AUTH_PASSWORD: 'persik2026',
  GOOGLE_TOKEN_JSON: readJsonFile('credentials/token.json'),
  GOOGLE_CLIENT_SECRET_JSON: readJsonFile('credentials/client_secret.json'),
};

console.log('Set these in Render → persik → Environment:\n');
for (const [key, value] of Object.entries(vars)) {
  if (!value) {
    console.log(`# ${key}= (missing locally)`);
    continue;
  }
  console.log(`${key}=${JSON.stringify(value)}`);
}

console.log('\nAlso set manually: GEMINI_API_KEY, PIPEDRIVE_TOKEN');
