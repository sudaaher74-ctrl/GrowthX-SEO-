import { test, expect, type Page } from '@playwright/test';
import { API_BASE } from './api-base';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('Browser error:', error.message, error.stack));
});

async function setup(page: Page, options: { empty?: boolean; fail?: boolean } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('growthx.session', '1');
    localStorage.setItem('growthx.org', 'org_test');
    localStorage.setItem('growthx.project', 'project_test');
  });
  await page.route(`${API_BASE}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/auth/me') return json({ id: 'user_test', role: 'OWNER', firstName: 'Test' });
    if (path === '/auth/csrf') return json({ csrf_token: 'test-csrf' });
    if (path === '/organizations') return json([{ id: 'org_test', name: 'Test workspace' }]);
    if (path === '/projects/org/org_test') return json(options.empty ? [] : [{ id: 'project_test', name: 'Measured business' }]);
    if (path.endsWith('/portfolio')) return json({ clients: [], summary: {}, alerts: [] });
    if (path.endsWith('/ai-visibility')) return json({
      periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-10-15T00:00:00Z',
      summary: { checked: 7, cited: 3, citationSharePct: 43, failedChecks: 2, averagePosition: null, previousCitationSharePct: null, deltaPt: null },
      byAssistant: [{ assistant: 'GEMINI', checked: 7, cited: 3, citationSharePct: 43 }, { assistant: 'OPENAI', checked: 0, cited: 0, citationSharePct: 0 }],
      shareOfVoice: [{ domain: null, label: 'Measured business', mentions: 3, sharePct: 60 }, { domain: 'measured-rival.test', label: 'Measured rival', mentions: 2, sharePct: 40 }],
      trend: [{ weekStart: '2026-10-15T00:00:00Z', checked: 7, citationSharePct: 43 }], measurableAssistants: ['GEMINI'],
    });
    if (path.endsWith('/prompts')) return json([{ id: 'p1', text: 'Stored buyer question', category: 'Discovery', latestChecks: [{ assistant: 'GEMINI', checkedAt: '2026-10-15T00:00:00Z', cited: true, answerExcerpt: 'A recorded provider answer.', model: 'gemini-2.5-flash' }] }]);
    if (path.endsWith('/citations')) return options.fail ? json({ message: 'Citation source unavailable' }, 503) : json({ totalCitations: 9, citationsByDomain: [{ domain: 'recorded-source.test', count: 9, ownCited: false }] });
    if (path.endsWith('/root-cause')) return json({ rivalsWinning: [{ brand: 'Measured rival', wins: 2 }], missedPrompts: [{ prompt: 'Stored missed question', category: 'Discovery', winner: 'Measured rival' }] });
    if (path.endsWith('/actions')) return json([{ id: 'a1', title: 'Recorded evidence action', priority: 8, status: 'OPEN', category: 'COMPETITOR', createdAt: '2026-10-15T00:00:00Z' }]);
    if (path.includes('/action-engine/') && path.endsWith('/competitors')) return json({ competitors: [] });
    if (path.endsWith('/competitors')) return json([]);
    return json({}, 404);
  });
}

test('all measurement tabs use stored API values and monitoring opens the review workflow', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility');
  await expect(page.getByText('3 of 7 answers mention you')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review questions & run monitoring' })).toHaveAttribute('href', '/ai-visibility/journey');
  await page.getByRole('tab', { name: 'Prompt Intelligence', exact: true }).click();
  await expect(page.getByText('Stored buyer question')).toBeVisible();
  await page.getByRole('button', { name: 'Responses', exact: true }).click();
  await expect(page.getByText('A recorded provider answer.')).toBeVisible();
  await page.getByRole('tab', { name: 'Citation Intelligence', exact: true }).click();
  await expect(page.getByRole('table').getByText('recorded-source.test')).toBeVisible();
  await page.getByRole('tab', { name: 'Competitor Comparison', exact: true }).click();
  await expect(page.getByText('Measured rival', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Root Cause Analysis', exact: true }).click();
  await expect(page.getByText('Stored missed question')).toBeVisible();
  await page.getByRole('tab', { name: 'Action Center', exact: true }).click();
  await expect(page.getByText('Recorded evidence action')).toBeVisible();
  await page.getByRole('tab', { name: 'Monitoring History', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('43%');
  await expect(page.getByRole('table').getByText('0%', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Configured', { exact: true })).toHaveCount(1);
  await page.getByRole('tab', { name: 'AI Model Visibility', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('43%');
  await page.getByRole('tab', { name: 'Unified Intelligence', exact: true }).click();
  await expect(page.getByText('Could not load this data')).toBeVisible();
  await expect(page.getByText('Aug 28, 2025', { exact: false })).toHaveCount(0);
});

test('no project never displays fabricated measurements', async ({ page }) => {
  await setup(page, { empty: true });
  await page.goto('/ai-visibility');
  await expect(page.getByText('Choose a project to view real measurements')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review questions & run monitoring' })).toHaveCount(0);
  await expect(page.getByText('78 /100', { exact: false })).toHaveCount(0);
});

test('a failed citation request is an error rather than demo or empty results', async ({ page }) => {
  await setup(page, { fail: true });
  await page.goto('/ai-visibility?tab=citations');
  await expect(page.getByText('Could not load this data')).toBeVisible();
  await expect(page.getByText('No verified citations recorded')).toHaveCount(0);
});
