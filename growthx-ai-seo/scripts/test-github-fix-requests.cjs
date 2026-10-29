const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.join(__dirname, '../src/lib');

function client() {
  const requests = [];
  const storage = new Map();
  const context = {
    process: { env: { NODE_ENV: 'test', NEXT_PUBLIC_API_URL: 'https://api.example.test' } },
    console, setTimeout, clearTimeout, AbortSignal, Math, Date,
    crypto: require('node:crypto').webcrypto,
    document: { cookie: 'csrf_token=test-nonce' },
    window: { location: { pathname: '/fix-engine' }, localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    } },
    navigator: {},
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ id: 'run-1', status: 'RUNNING' }), { status: 200 });
    },
  };
  function load(file) {
    const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const scope = { ...context, exports: {}, require: name => load(`${name.replace('./', '')}.ts`) };
    vm.runInNewContext(output, scope);
    return scope.exports;
  }
  return { api: load('api-client.ts').api, requests };
}

test('selected findings reach the plan endpoint without being converted to a dummy engineer request', async () => {
  const { api, requests } = client();
  await api.runPlanFixes('project-1', { findingIds: ['duplicate-title'], sourceModule: 'WEBSITE' });
  assert.equal(requests[0].url, 'https://api.example.test/api/projects/project-1/automation/runs/plan-fixes');
  assert.deepEqual(requests[0].body, { findingIds: ['duplicate-title'], sourceModule: 'WEBSITE' });
});

test('custom requests preserve all lines and punctuation', async () => {
  const { api, requests } = client();
  const instruction = 'Give the cart a unique title.\nUse "Your Cart" and preserve the existing description.';
  await api.runEngineer('project-1', instruction);
  assert.equal(requests[0].body.instruction, instruction);
});
