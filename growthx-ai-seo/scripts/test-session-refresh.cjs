const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function compile(name) {
  return ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib', name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function load(context, code) {
  context.exports = {};
  vm.runInNewContext(code, context);
  return context.exports;
}
function browser(handler, storage = new Map()) {
  const location = { pathname: '/dashboard', href: '/dashboard' };
  const context = { process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.example.test' } }, console, setTimeout, clearTimeout, AbortSignal, Math, Date, crypto: require('node:crypto').webcrypto,
    document: { cookie: '' }, window: { location, localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } }, navigator: {}, fetch: handler };
  const refresh = load({ ...context }, compile('session-refresh.ts'));
  context.require = name => { if (name === './session-refresh') return refresh; if (name === './api-types') return load({ ...context }, compile('api-types.ts')); throw new Error(name); };
  const client = load(context, compile('api-client.ts'));
  client.auth.markSignedIn();
  return { client, location, storage };
}
const response = status => new Response(JSON.stringify({ message: 'Unauthorized' }), { status, headers: { 'Content-Type': 'application/json' } });
test('temporary refresh outage preserves session, workspace and current page', async () => {
  const { client, location, storage } = browser(async url => url.endsWith('/auth/csrf') ? new Response('{"csrf_token":"nonce"}') : response(url.endsWith('/auth/refresh') ? 503 : 401));
  client.auth.setProjectId('project');
  await assert.rejects(client.api.mammouth.getConfig(), error => error.status === 503);
  assert.equal(storage.get('growthx.session'), '1');
  assert.equal(client.auth.getProjectId(), 'project');
  assert.equal(location.href, '/dashboard');
});
test('network failure during refresh does not sign out', async () => {
  const { client, location } = browser(async url => { if (url.endsWith('/auth/refresh')) throw new Error('offline'); return response(401); });
  await assert.rejects(client.api.mammouth.getConfig(), error => error.status === 503);
  assert.equal(client.auth.isAuthenticated(), true);
  assert.equal(location.href, '/dashboard');
});
test('resource-specific 401 after successful refresh does not sign out', async () => {
  const { client, location } = browser(async url => url.endsWith('/auth/refresh') ? response(200) : url.endsWith('/auth/csrf') ? new Response('{"csrf_token":"nonce"}') : response(401));
  await assert.rejects(client.api.mammouth.getConfig(), error => error.status === 401);
  assert.equal(client.auth.isAuthenticated(), true);
  assert.equal(location.href, '/dashboard');
});
test('confirmed expired refresh and access sessions require sign-in', async () => {
  const { client, location } = browser(async () => response(401));
  await assert.rejects(client.api.mammouth.getConfig(), error => error.status === 401);
  assert.equal(client.auth.isAuthenticated(), false);
  assert.equal(location.href, '/login');
});
test('concurrent tabs share one rotation under a browser-wide lock', async () => {
  const { createSessionRefresh } = load({}, compile('session-refresh.ts'));
  let version = '', rotations = 0, queue = Promise.resolve();
  const deps = { version: () => version, publish: () => { version = 'new'; }, refresh: async () => { rotations++; return 'refreshed'; }, lock: run => { const result = queue.then(run); queue = result; return result; } };
  const tabA = createSessionRefresh(deps), tabB = createSessionRefresh(deps);
  assert.deepEqual(await Promise.all([tabA(''), tabA(''), tabB('')]), ['refreshed', 'refreshed', 'refreshed']);
  assert.equal(rotations, 1);
});

test('silent renewal retries a temporary failure without losing the session', async () => {
  let attempts = 0;
  const { client, location } = browser(async url => url.endsWith('/auth/csrf') ? new Response('{"csrf_token":"nonce"}') : response(++attempts === 1 ? 503 : 200));
  assert.equal(await client.renewSession(), 'refreshed');
  assert.equal(attempts, 2);
  assert.equal(client.auth.isAuthenticated(), true);
  assert.equal(location.href, '/dashboard');
});

test('manual logout stops silent renewal', async () => {
  let requests = 0;
  const { client } = browser(async () => { requests++; return response(200); });
  client.auth.clear();
  assert.equal(await client.renewSession(), 'expired');
  assert.equal(requests, 0);
});
