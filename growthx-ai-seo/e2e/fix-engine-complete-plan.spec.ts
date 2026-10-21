import { expect, test } from '@playwright/test';
import { API_BASE } from './api-base';

test('four-module plan and PDF report include the final findings page and evidence', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('growthx.token', 'test-token');
    localStorage.setItem('growthx.org', 'org_test');
    localStorage.setItem('growthx.project', 'project_test');
  });
  const make = (id: string, source: string, title: string) => ({ id, source, title, summary: 'Saved source recommendation', recommendedAction: '1. Review the evidence\n2. Publish the change', evidence: [{ label: 'Measured source', value: 'Original report observation', source }], potential: 'HIGH', effort: 'LOW', confidence: 70, lifecycle: 'QUEUED', fixClass: 'MANUAL', detailType: 'REPORT_PLAN', detectedAt: '2026-10-21T00:00:00Z' });
  const first = [make('w', 'WEBSITE', 'Repair canonical'), make('g', 'SEARCH_CONSOLE', 'Improve search snippet'), make('c', 'COMPETITOR', 'Publish comparison')];
  const last = make('a', 'MARKET', 'Answer buyer questions');
  let finalPageRequests = 0;
  await page.route(`${API_BASE}/**`, async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/organizations') return json([{ id: 'org_test', name: 'Test', slug: 'test' }]);
    if (path === '/projects/org/org_test') return json([{ id: 'project_test', name: 'Test' }]);
    if (path.endsWith('/portfolio')) return json({ clients: [{ projectId: 'project_test', domain: 'example.com', trend: [] }], summary: {}, alerts: [] });
    if (path.endsWith('/findings/sync')) return json({ created: 0, updated: 4, resolved: 0, warnings: [] });
    if (path.endsWith('/findings')) {
      const final = url.searchParams.has('cursor'); if (final) finalPageRequests++;
      return json({ items: final ? [last] : first, nextCursor: final ? null : 'c', counts: { total: 4, bySource: {}, byFixClass: {} } });
    }
    if (path.endsWith('/history') || path.endsWith('/ledger') || path.endsWith('/runs')) return json([]);
    return json(null);
  });
  await page.goto('/fix-engine');
  await expect(page.getByRole('tab', { name: 'Improvement plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('One plan across your four modules')).toBeVisible();
  await expect(page.getByText('Answer buyer questions', { exact: true })).toBeVisible();
  expect(finalPageRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: /^AI Visibility 1$/ }).click();
  await expect(page.getByText('Repair canonical', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Answer buyer questions/ }).click();
  await expect(page.getByText('Original report observation', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open source report →' })).toHaveAttribute('href', '/ai-visibility?tab=actions');
  await page.getByRole('link', { name: /Open complete plan report/ }).click();
  await expect(page.getByRole('heading', { name: 'Complete improvement plan', exact: true })).toBeVisible();
  for (const moduleName of ['Website Audit', 'Google', 'Competitor Intelligence', 'AI Visibility']) await expect(page.getByRole('heading', { name: `${moduleName} (1)`, exact: true })).toBeVisible();
  await expect(page.getByText('Answer buyer questions', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
});
