import assert from 'node:assert/strict';
import test from 'node:test';

const base = (process.env.ROUTING_SMOKE_BASE_URL || '').replace(/\/$/, '');

function skipIfNoBase() {
  if (!base) {
    test.skip(
      'Set ROUTING_SMOKE_BASE_URL (preview or production origin, no trailing path) to run HTTP smoke tests',
    );
    return true;
  }
  return false;
}

async function fetchFollow(path, { redirect = 'manual' } = {}) {
  const url = `${base}${path}`;
  const response = await fetch(url, {
    redirect,
    headers: { 'user-agent': 'solar-routing-smoke/1.0' },
  });
  const contentType = response.headers.get('content-type') || '';
  const location = response.headers.get('location') || '';
  const body = contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript')
    ? await response.text()
    : '';
  return { status: response.status, contentType, location, body, url };
}

function isQuotesHtml(body) {
  return (
    body.includes('הצעת מחיר') ||
    body.includes('טוען את המערכת')
  );
}

function isSolarUpHtml(body) {
  return body.includes('Solar UP');
}

function isCrmHtml(body) {
  return body.includes('MES CRM');
}

if (skipIfNoBase()) {
  // HTTP assertions run only when an origin is provided.
} else {
  test('GET / is the quotes program', async () => {
    const res = await fetchFollow('/', { redirect: 'follow' });
    assert.equal(res.status, 200);
    assert.match(res.contentType, /text\/html/);
    assert.equal(isQuotesHtml(res.body), true);
    assert.equal(isSolarUpHtml(res.body), false);
    assert.equal(isCrmHtml(res.body), false);
  });

  test('GET /APP is 308 to /APP/', async () => {
    const res = await fetchFollow('/APP?x=1');
    assert.equal(res.status, 308);
    assert.match(res.location, /\/APP\//);
    assert.match(res.location, /[?&]x=1/);
  });

  test('GET /APP/ is Solar UP, not quotes HTML', async () => {
    const res = await fetchFollow('/APP/', { redirect: 'follow' });
    assert.equal(res.status, 200);
    assert.match(res.contentType, /text\/html/);
    assert.equal(isSolarUpHtml(res.body), true);
    assert.equal(isQuotesHtml(res.body), false);
  });

  test('GET /APP/login and /APP/login/ are Solar UP', async () => {
    for (const path of ['/APP/login', '/APP/login/']) {
      const res = await fetchFollow(path, { redirect: 'follow' });
      assert.equal(res.status, 200, path);
      assert.equal(isSolarUpHtml(res.body), true, path);
      assert.equal(isQuotesHtml(res.body), false, path);
    }
  });

  test('GET /APP/api/cron/plant-sync is not quotes HTML', async () => {
    const res = await fetchFollow('/APP/api/cron/plant-sync');
    assert.notEqual(res.status, 308);
    assert.equal(isQuotesHtml(res.body), false);
    assert.equal(res.contentType.includes('text/html') && isQuotesHtml(res.body), false);
  });

  test('GET /crm is 308 to /crm/', async () => {
    const res = await fetchFollow('/crm?y=2');
    assert.equal(res.status, 308);
    assert.match(res.location, /\/crm\//);
    assert.match(res.location, /[?&]y=2/);
  });

  test('GET /crm/ and /crm/login are CRM', async () => {
    for (const path of ['/crm/', '/crm/login']) {
      const res = await fetchFollow(path, { redirect: 'follow' });
      assert.equal(res.status, 200, path);
      assert.equal(isCrmHtml(res.body), true, path);
      assert.equal(isQuotesHtml(res.body), false, path);
    }
  });

  test('GET /crm/api/auth/login is not quotes HTML', async () => {
    const res = await fetchFollow('/crm/api/auth/login', { redirect: 'manual' });
    assert.equal(isQuotesHtml(res.body), false);
    assert.equal(res.contentType.includes('text/html') && /הצעת מחיר/.test(res.body), false);
  });

  test('GET /app is not the quotes calculator', async () => {
    const res = await fetchFollow('/app', { redirect: 'follow' });
    assert.equal(res.status, 404);
    assert.equal(isSolarUpHtml(res.body), false);
  });

  test('GET /foo is 404, not quotes SPA', async () => {
    const res = await fetchFollow('/foo', { redirect: 'follow' });
    assert.equal(res.status, 404);
  });

  test('GET /sw.js is not HTML of the quotes app', async () => {
    const res = await fetchFollow('/sw.js');
    assert.equal(res.status, 404);
    assert.equal(isQuotesHtml(res.body) && res.contentType.includes('text/html') && res.body.includes('id="root"'), false);
    assert.equal(res.contentType.includes('application/javascript'), false);
  });

  test('missing static assets return 404', async () => {
    for (const path of ['/missing-asset.js', '/missing-asset.css', '/missing-asset.json']) {
      const res = await fetchFollow(path);
      assert.equal(res.status, 404, path);
    }
  });
}
