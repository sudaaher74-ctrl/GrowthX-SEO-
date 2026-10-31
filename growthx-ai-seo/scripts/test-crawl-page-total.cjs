const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, ...args);
};
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(result.outputText, filename);
  };
}
const { crawlPageTotal } = require('../src/lib/crawl-page-total.ts');
assert.equal(crawlPageTotal(757, 758, 100), 758);
assert.equal(crawlPageTotal(757, undefined, 100), 757);
assert.equal(crawlPageTotal(0, 0, 0), 0);
assert.equal(crawlPageTotal(0, undefined, 100), 0);
assert.equal(crawlPageTotal(undefined, undefined, 100), 100);
assert.equal(crawlPageTotal(NaN, -1, 20), 20);
const { PagesKpis } = require('../src/components/website/pages/pages-kpis.tsx');
const kpis = renderToStaticMarkup(React.createElement(PagesKpis, {
  totalPages: 757, successfulCount: 100, pagesCount: 100, pagesDelta: null,
  erroredCount: 0, redirectedCount: 0, blockedCount: 0, unreachableCount: 0,
  urlsDiscoveredCount: 9614, urlsCrawledCount: 757, notCrawledCount: 8857,
  indexableCount: 100, indexablePct: 100, nonIndexableCount: 0,
  unknownIndexabilityCount: 0, crawlCoveragePct: null, crawlIsPartial: false,
  duplicatesCount: 0, canonicalizedCount: 0,
}));
assert.match(kpis, />757</);
assert.match(kpis, /Status counts below describe the loaded pages/);
console.log('Crawl totals: 6 count cases and rendered dashboard card passed.');
