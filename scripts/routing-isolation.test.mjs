import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

test('does not use the Create React App SPA catch-all', () => {
  assert.equal(vercel.framework, null);
  assert.equal(vercel.outputDirectory, 'build');
  const indexRewrites = (vercel.rewrites ?? []).filter((rule) =>
    String(rule.destination).endsWith('/index.html'),
  );
  assert.deepEqual(
    indexRewrites.map((rule) => rule.source),
    ['/q/:path*'],
  );
});

test('returns a real 404 after filesystem and explicit rewrites miss', () => {
  const routes = vercel.routes ?? [];
  assert.deepEqual(routes.slice(-2), [
    { handle: 'filesystem' },
    { src: '/.*', status: 404 },
  ]);
  assert.ok(routes.some((route) => route.src === '/APP/' && route.dest?.includes('solar-up')));
  assert.ok(routes.some((route) => route.src === '/crm/' && route.dest?.includes('mes-crm')));
  assert.ok(routes.some((route) => route.src === '/q/(.*)' && route.dest === '/index.html'));
});

test('canonical /APP redirects to /APP/ with 308', () => {
  const rule = (vercel.redirects ?? []).find((item) => item.source === '/APP');
  assert.ok(rule, 'missing /APP redirect');
  assert.equal(rule.destination, '/APP/');
  assert.equal(rule.statusCode, 308);
  const route = (vercel.routes ?? []).find((item) => item.src === '/APP');
  assert.equal(route?.status, 308);
  assert.equal(route?.headers?.Location, '/APP/');
});

test('canonical /crm redirects to /crm/ with 308', () => {
  const rule = (vercel.redirects ?? []).find((item) => item.source === '/crm');
  assert.ok(rule, 'missing /crm redirect');
  assert.equal(rule.destination, '/crm/');
  assert.equal(rule.statusCode, 308);
  const route = (vercel.routes ?? []).find((item) => item.src === '/crm');
  assert.equal(route?.status, 308);
  assert.equal(route?.headers?.Location, '/crm/');
});

test('does not alias lowercase /app to Solar UP', () => {
  const sources = [
    ...(vercel.redirects ?? []).map((item) => item.source),
    ...(vercel.rewrites ?? []).map((item) => item.source),
  ];
  assert.equal(sources.includes('/app'), false);
  assert.equal(sources.includes('/app/'), false);
  assert.equal(sources.includes('/app/:path*'), false);
});

test('proxies /APP/ and nested APP paths to solar-up without stripping /APP', () => {
  const rules = vercel.rewrites ?? [];
  const rootApp = rules.find((item) => item.source === '/APP/');
  const nested = rules.find((item) => item.source === '/APP/:path(.*)');
  assert.equal(rootApp?.destination, 'https://solar-up.vercel.app/APP/');
  assert.equal(nested?.destination, 'https://solar-up.vercel.app/APP/:path*');
});

test('proxies /crm/ and nested CRM paths to mes-crm', () => {
  const rules = vercel.rewrites ?? [];
  const rootCrm = rules.find((item) => item.source === '/crm/');
  const nested = rules.find((item) => item.source === '/crm/:path(.*)');
  assert.equal(rootCrm?.destination, 'https://mes-crm-ten.vercel.app/crm/');
  assert.equal(nested?.destination, 'https://mes-crm-ten.vercel.app/crm/:path*');
});

test('APP and CRM rewrites are declared before quote SPA routes', () => {
  const sources = (vercel.rewrites ?? []).map((item) => item.source);
  assert.ok(sources.indexOf('/APP/') < sources.indexOf('/q/:path*'));
  assert.ok(sources.indexOf('/crm/') < sources.indexOf('/q/:path*'));
});

test('quote Open Graph and share routes stay on the quotes app', () => {
  const rules = vercel.rewrites ?? [];
  assert.ok(rules.some((item) => item.source === '/q/:id' && item.destination.includes('/api/quote-og')));
  assert.ok(rules.some((item) => item.source === '/q/:path*' && item.destination === '/index.html'));
});
