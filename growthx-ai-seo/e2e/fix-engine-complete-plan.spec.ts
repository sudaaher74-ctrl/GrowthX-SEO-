import { expect, test } from '@playwright/test';
import { API_BASE } from './api-base';

test('manual findings stay out of batches and legacy GitHub connections require reconnect', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('growthx.session', '1');
    localStorage.setItem('growthx.org', 'org_batch');
    localStorage.setItem('growthx.project', 'project_batch');
    localStorage.setItem('growthx_subscription_claim_org_batch', JSON.stringify({
      tierId: 'agency',
      tierName: 'Agency',
      status: 'active',
      billingCycle: 'monthly',
      currency: 'INR',
    }));
  });
  const base = {
    source: 'WEBSITE',
    category: 'SEO',
    summary: 'Saved recommendation',
    recommendedAction: 'Review the recommendation and publish the change.',
    evidence: [],
    affectedPages: ['https://example.com/'],
    lifecycle: 'DETECTED',
    potential: 'HIGH',
    effort: 'LOW',
    confidence: 90,
  };
  const manual = { ...base, id: 'manual', source: 'BACKLINKS', title: 'Submit directory citations', fixClass: 'MANUAL' };
  const automatic = { ...base, id: 'auto', title: 'Update the homepage meta title', fixClass: 'AUTO' };
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (path === '/auth/me') return json({ id: 'batch-user', role: 'OWNER' });
    if (path === '/organizations') return json([{ id: 'org_batch', name: 'Batch workspace' }]);
    if (path === '/projects/org/org_batch') return json([{ id: 'project_batch', name: 'example.com' }]);
    if (path.endsWith('/automation/repository')) {
      return json({ owner: 'example', name: 'site', tokenConfigured: false, reconnectRequired: true });
    }
    if (path.endsWith('/findings')) {
      return json({ items: [manual, automatic], nextCursor: null, counts: { total: 2, bySource: {}, byFixClass: {} } });
    }
    if (path.endsWith('/findings/sync')) return json({ created: 0, updated: 0, resolved: 0, warnings: [] });
    return json(null);
  });

  await page.goto('/fix-engine');
  await page.getByRole('checkbox', { name: `Select ${manual.title}` }).check();
  await expect(page.getByText(/1 issue requires manual work/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Batch Auto-Apply/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: `Select ${automatic.title}` }).check();
  await page.getByRole('button', { name: /Batch Auto-Apply \(1\)/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Batch apply selected SEO fixes' });
  await expect(dialog.getByText(automatic.title, { exact: true })).toBeVisible();
  await expect(dialog.getByText(manual.title, { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Reconnect required', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Create 1 Unified PR/ })).toBeDisabled();
  await expect(dialog.getByRole('link', { name: 'Open GitHub setup' })).toHaveAttribute('href', '/fix-engine?tab=github-fixes');
});

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
  await expect(page.getByRole('tab', { name: 'Improvement', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Answer buyer questions', { exact: true })).toBeVisible();
  expect(finalPageRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: /^AI Visibility 1$/ }).click();
  await expect(page.getByText('Repair canonical', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Answer buyer questions/ }).click();
  await expect(page.getByText('Original report observation', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open source report →' })).toHaveAttribute('href', '/ai-visibility?tab=actions');
  await page.getByRole('link', { name: /Complete plan report/ }).click();
  await expect(page.getByRole('heading', { name: 'Complete improvement plan', exact: true })).toBeVisible();
  for (const moduleName of ['Website Audit', 'Traffic', 'Competitor Intelligence', 'AI Visibility']) await expect(page.getByRole('heading', { name: `${moduleName} (1)`, exact: true })).toBeVisible();
  await expect(page.getByText('Answer buyer questions', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
});

test('saved proposals reach the engineer without becoming fabricated detector findings', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('growthx.session','1');
    localStorage.setItem('growthx.org','org_test');
    localStorage.setItem('growthx.project','project_test');
  });
  let engineerRequests = 0;
  const task = {id:'saved-review',projectId:'project_test',title:'Review a recorded competitor source',source:'AI_VISIBILITY',category:'CONTENT',priority:'MEDIUM',impact:'Not measured',effortHours:0,deliverable:'Inspect the saved answer and compare actual source pages before proposing an edit.',evidence:'One saved answer reference; website address not verified.',status:'STAGED',stagedAt:'2026-10-29T00:00:00Z'};
  await page.route(`${API_BASE}/**`,async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body:unknown) => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path === '/auth/me') return json({id:'user_test',role:'OWNER',firstName:'Test'});
    if(path === '/organizations') return json([{id:'org_test',name:'Test',slug:'test'}]);
    if(path === '/projects/org/org_test') return json([{id:'project_test',name:'Test'}]);
    if(path.endsWith('/saved-plans')) return json([task]);
    if(path.endsWith('/findings/sync')) return json({created:0,updated:0,resolved:0,warnings:[]});
    if(path.endsWith('/findings')) return json({items:[],nextCursor:null,counts:{total:0,bySource:{},byFixClass:{}}});
    if(path.endsWith('/engineer') && route.request().method()==='POST') engineerRequests++;
    if(path.endsWith('/runs') || path.endsWith('/ledger') || path.endsWith('/history')) return json([]);
    if(path.endsWith('/repo')) return json(null);
    return json(null);
  });
  await page.goto('/fix-engine');
  await expect(page.getByRole('heading',{name:'Saved improvement tasks (1)',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:task.title,exact:true})).toBeVisible();
  await expect(page.getByText('Build foundational niche backlinks and partner citations',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Balance inbound anchor text distribution with brand-first anchors',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Use in GitHub Engineer',exact:true}).click();
  const instruction = page.getByRole('textbox',{name:'Custom instruction for the GitHub Engineer',exact:true});
  await expect(instruction).toHaveValue(new RegExp(task.title));
  await expect(instruction).toHaveValue(/Inspect the saved answer/);
  expect((await instruction.inputValue()).length).toBeLessThanOrEqual(2000);
  expect(engineerRequests).toBe(0);
  for (const alias of ['impact-ledger', 'ledger', 'proof']) {
    await page.goto(`/fix-engine?tab=${alias}`);
    await expect(page.getByRole('tab', { name: 'Improvement Journey', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'GitHub Fixes & Improvement Log', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Complete Improvement Log — What We Did & What We Improved', { exact: true })).toBeVisible();
  }
});
