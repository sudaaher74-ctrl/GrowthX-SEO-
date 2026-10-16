import type { Page } from '@playwright/test';
import { API_BASE } from '../api-base';
export async function setup(page: Page, options: { empty?: boolean; fail?: boolean } = {}) {
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
    if (path === '/projects/org/org_test') return json(options.empty ? [] : [{ id: 'project_test', name: 'Measured business' }, {id:'project_second',name:'Second business'}]);
    if (path.endsWith('/portfolio')) return json({ clients: [], summary: {}, alerts: [] });
    if (path.endsWith('/ai-visibility')) return json({
      periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-10-15T00:00:00Z',
      summary: { checked: 7, cited: 3, citationSharePct: 43, failedChecks: 2, averagePosition: null, previousCitationSharePct: null, deltaPt: null },
      byAssistant: [{ assistant: 'GEMINI', checked: 7, cited: 3, citationSharePct: 43, citations: 9 }, { assistant: 'OPENAI', checked: 0, cited: 0, citationSharePct: 0 }],
      shareOfVoice: [{ domain: null, label: 'Measured business', mentions: 3, sharePct: 60 }, { domain: 'measured-rival.test', label: 'Measured rival', mentions: 2, sharePct: 40 }],
      trend: [{ weekStart: '2026-10-15T00:00:00Z', checked: 7, citationSharePct: 43 }], measurableAssistants: ['GEMINI'],
    });
    if (path.endsWith('/journey')) return json({ journey: null, answers: [], providers: [
      {provider:'GEMINI',configured:true,model:'gemini-2.5-flash'},
      {provider:'OPENAI',configured:true,model:'openai/gpt-4.1-mini'},
      {provider:'ANTHROPIC',configured:true,model:'anthropic/claude-haiku-4.5'},
      {provider:'PERPLEXITY',configured:true,model:'perplexity/sonar'},
      {provider:'GROK',configured:true,model:'x-ai/grok-4-fast',unavailableReason:'Approved Grok model is unavailable.'},
    ] });
    if (path.endsWith('/prompts')) return json([{ id: 'p1', text: 'Stored buyer question', category: 'Discovery', latestChecks: [{ assistant: 'GEMINI', checkedAt: '2026-10-15T00:00:00Z', cited: true, answerExcerpt: 'A recorded provider answer.', model: 'gemini-2.5-flash' }] }]);
    if (path.endsWith('/citations')) return options.fail ? json({ message: 'Citation source unavailable' }, 503) : json({ totalCitations: 9, citationsByDomain: [{ domain: 'recorded-source.test', count: 9, ownCited: false }] });
    if (path.endsWith('/root-cause')) return json({ rivalsWinning: [{ brand: 'Measured rival', wins: 2 }], missedPrompts: [{ prompt: 'Stored missed question', category: 'Discovery', winner: 'Measured rival' }] });
    if (path.endsWith('/actions')) return json([{ id: 'a1', title: 'Recorded evidence action', priority: 8, status: 'OPEN', category: 'COMPETITOR', createdAt: '2026-10-15T00:00:00Z' }]);
    if (path.includes('/action-engine/') && path.endsWith('/competitors')) return json({ competitors: [] });
    if (path.endsWith('/competitors')) return json([]);
    return json({}, 404);
  });
}

