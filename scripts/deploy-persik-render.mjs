/**
 * Deploy Persik to Render via API.
 * Requires: RENDER_API_KEY in environment (Account Settings → API Keys)
 *
 * Usage:
 *   set RENDER_API_KEY=rnd_xxx
 *   node scripts/deploy-persik-render.mjs
 */
const API = 'https://api.render.com/v1';
const REPO = 'https://github.com/9108580/solar';
const BRANCH = 'main';
const BLUEPRINT_PATH = 'render-persik.yaml';

async function api(path, options = {}) {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    console.error('Missing RENDER_API_KEY. Create at https://dashboard.render.com/u/settings#api-keys');
    process.exit(1);
  }
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log('Creating/updating Render Blueprint for Persik...');
  const owner = await api('/owners?limit=1');
  const ownerId = owner?.[0]?.owner?.id || owner?.[0]?.id;
  if (!ownerId) throw new Error('Could not resolve Render owner id');

  const blueprint = await api('/blueprints', {
    method: 'POST',
    body: JSON.stringify({
      name: 'mes-persik',
      repo: REPO,
      branch: BRANCH,
      path: BLUEPRINT_PATH,
      autoSync: true,
    }),
  });

  console.log('Blueprint created:', blueprint?.id || blueprint);
  console.log('\nNext: open Render Dashboard → persik service → Environment');
  console.log('Run: node persik/scripts/export-render-secrets.mjs');
  console.log('Add GEMINI_API_KEY and PIPEDRIVE_TOKEN, then redeploy.');
  console.log('\nCustom domain: persik.mes.bet → Render service URL');
  console.log('mes.bet/persik proxy is already configured in vercel.json');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
