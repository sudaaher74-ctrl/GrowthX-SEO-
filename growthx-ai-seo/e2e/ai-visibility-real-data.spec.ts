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
      byAssistant: [{ assistant: 'GEMINI', checked: 7, cited: 3, citationSharePct: 43 }, { assistant: 'OPENAI', checked: 0, cited: 0, citationSharePct: 0 }, { assistant: 'ANTHROPIC', checked: 17, cited: 13, citationSharePct: 76 }],
      shareOfVoice: [{ domain: null, label: 'Measured business', mentions: 3, sharePct: 60 }, { domain: 'measured-rival.test', label: 'Measured rival', mentions: 2, sharePct: 40 }],
      trend: [{ weekStart: '2026-10-15T00:00:00Z', checked: 7, citationSharePct: 43 }], measurableAssistants: ['GEMINI'],
    });
    if (path.endsWith('/prompts')) return json([{ id: 'p1', text: 'Stored buyer question', category: 'Discovery', latestChecks: [{ assistant: 'GEMINI', checkedAt: '2026-10-15T00:00:00Z', cited: true, answerExcerpt: 'A recorded provider answer.', model: 'gemini-2.5-flash' }] }]);
    if (path.endsWith('/questions')) return json({questions:[{id:'pending',text:'Saved pending buyer question',group:'BUYER',outcome:'NOT_MEASURED',answer:null,failure:null,verdict:'NOT_APPLICABLE',ownPage:null,rivals:[],comparison:[]}]});
    if (path.endsWith('/prompts/generate')) return json({message:'Monitoring provider is temporarily unavailable'},503);
    if (path.endsWith('/citations')) return options.fail ? json({ message: 'Citation source unavailable' }, 503) : json({ totalCitations: 9, citationsByDomain: [{ domain: 'recorded-source.test', count: 9, ownCited: false }] });
    if (path.endsWith('/root-cause')) return json({ rivalsWinning: [{ brand: 'Measured rival', wins: 2 }], missedPrompts: [{ prompt: 'Stored missed question', category: 'Discovery', winner: 'Measured rival' }] });
    if (path.endsWith('/actions')) return json([{ id: 'a1', title: 'Recorded evidence action', priority: 8, status: 'OPEN', category: 'COMPETITOR', createdAt: '2026-10-15T00:00:00Z' }]);
    if (path.includes('/action-engine/') && path.endsWith('/competitors')) return json({ competitors: [] });
    if (path.endsWith('/competitors')) return json([]);
    return json({}, 404);
  });
}

test('navigation restores Google and competitor website audit', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility?tab=competitors');
  await expect(page.getByRole('link', {name:/^Google/})).toHaveAttribute('href','/google');
  await expect(page.getByRole('link', {name:/^Competitor Intelligence/})).toHaveAttribute('href','/competitor-intelligence');
  await expect(page.getByText('measured-rival.test',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('countrydelight.com',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Paneer Recipes',{exact:true})).toHaveCount(0);
  await page.getByRole('link', {name:/^Competitor Intelligence/}).click();
  await expect(page.getByRole('tab',{name:'Battleground',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add competitor',exact:true}).first()).toBeVisible();
});
test('citation and root cause dashboards show saved evidence', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility?tab=citations');
  await expect(page.getByRole('table').getByText('recorded-source.test')).toBeVisible();
  await page.goto('/ai-visibility?tab=root-cause');
  await expect(page.getByText('Stored missed question')).toBeVisible();
});
test('empty projects do not display measurements', async ({ page }) => {
  await setup(page, {empty:true});
  await page.goto('/ai-visibility');
  await expect(page.getByText('Choose a project to view real measurements')).toBeVisible();
});
test('failed requests show errors without fabricated results', async ({ page }) => {
  await setup(page, {fail:true});
  await page.goto('/ai-visibility?tab=citations');
  await expect(page.getByText('Could not load this data')).toBeVisible();
  await expect(page.getByText('No verified citations recorded')).toHaveCount(0);
});

test('question generation failures are visible and retryable', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility');
  const generate = page.getByRole('button',{name:'Auto-Discover Questions',exact:true}).first();
  await generate.click();
  await expect(page.getByText('Monitoring provider is temporarily unavailable')).toBeVisible();
  await expect(generate).toBeEnabled();
});

test('unchecked questions are not counted as missed opportunities', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility');
  await expect(page.getByText('Saved pending buyer question',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Gaps (Uncited)',exact:true}).click();
  await expect(page.getByText('Saved pending buyer question',{exact:true})).toHaveCount(0);
});

test('Claude cards use measured ANTHROPIC API records', async ({ page }) => {
  await setup(page);
  await page.goto('/ai-visibility');
  await expect(page.getByText('13 mentions',{exact:true})).toBeVisible();
});

