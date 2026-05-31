#!/usr/bin/env node
/**
 * Full Persik deploy to Render: blueprint + env vars from local files.
 * Requires RENDER_API_KEY (env or persik/secrets.local.json renderApiKey field).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.render.com/v1';
const REPO = 'https://github.com/9108580/solar';
const BRANCH = 'main';
const BLUEPRINT_PATH = 'render-persik.yaml';
const SERVICE_NAME = 'persik';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const persikRoot = path.join(root, 'persik');

function readJson(relPath) {
  const full = path.join(persikRoot, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8').trim();
}

function loadLocalSecrets() {
  const file = path.join(persikRoot, 'secrets.local.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function buildEnvVars() {
  const local = loadLocalSecrets();
  return {
    PERSIK_SERVER: '1',
    AUTO_PRINT_INVOICES: 'false',
    PERSIK_AUTH_USER: 'mes',
    PERSIK_AUTH_PASSWORD: 'persik2026',
    GOOGLE_TOKEN_JSON: readJson('credentials/token.json'),
    GOOGLE_CLIENT_SECRET_JSON: readJson('credentials/client_secret.json'),
    GEMINI_API_KEY: local.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    PIPEDRIVE_TOKEN: local.PIPEDRIVE_TOKEN || process.env.PIPEDRIVE_TOKEN || '',
  };
}

async function api(key, apiPath, options = {}) {
  const res = await fetch(`${API}${apiPath}`, {
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
    throw new Error(`${res.status} ${apiPath}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService(key) {
  const list = await api(key, '/services?limit=100');
  const items = Array.isArray(list) ? list : list?.items || [];
  for (const item of items) {
    const svc = item.service || item;
    if (svc?.name === SERVICE_NAME || svc?.slug === SERVICE_NAME) {
      return svc;
    }
  }
  return null;
}

async function setEnvVars(key, serviceId, envVars) {
  for (const [envKey, value] of Object.entries(envVars)) {
    if (!value) {
      console.warn(`Skip empty env: ${envKey}`);
      continue;
    }
    await api(key, `/services/${serviceId}/env-vars`, {
      method: 'POST',
      body: JSON.stringify({ envVar: { key: envKey, value } }),
    });
    console.log(`Set ${envKey}`);
  }
}

async function triggerDeploy(key, serviceId) {
  await api(key, `/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  });
  console.log('Deploy triggered');
}

async function main() {
  const local = loadLocalSecrets();
  const key = process.env.RENDER_API_KEY || local.renderApiKey || '';
  if (!key) {
    console.error('Missing RENDER_API_KEY.');
    console.error('Add to env or persik/secrets.local.json as "renderApiKey": "rnd_..."');
    console.error('Create key: https://dashboard.render.com/u/settings#api-keys');
    process.exit(1);
  }

  console.log('Syncing Render Blueprint...');
  try {
    await api(key, '/blueprints', {
      method: 'POST',
      body: JSON.stringify({
        name: 'mes-persik',
        repo: REPO,
        branch: BRANCH,
        path: BLUEPRINT_PATH,
        autoSync: true,
      }),
    });
    console.log('Blueprint created/updated');
  } catch (err) {
    console.warn('Blueprint step:', err.message);
  }

  let service = await findService(key);
  if (!service) {
    console.log('Waiting for service to appear (up to 3 min)...');
    for (let i = 0; i < 18; i += 1) {
      await new Promise((r) => setTimeout(r, 10000));
      service = await findService(key);
      if (service) break;
    }
  }

  if (!service?.id) {
    throw new Error(
      'Service "persik" not found. Open https://dashboard.render.com/blueprint/new?repo=https://github.com/9108580/solar and apply render-persik.yaml',
    );
  }

  console.log('Service:', service.id, service.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`);
  await setEnvVars(key, service.id, buildEnvVars());
  await triggerDeploy(key, service.id);
  console.log('\nDone. mes.bet/persik will work when deploy finishes.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
