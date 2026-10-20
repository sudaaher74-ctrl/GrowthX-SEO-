import { test, expect, type Page } from '@playwright/test';
import { API_BASE } from './api-base';

async function setup(page: Page, audited = true, failure = false) {
  const selected: unknown[] = [];
  let discoveries = 0;
  let tracked: unknown[] = [];
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
    if (path === '/projects/org/org_test') return json([{ id: 'project_test', name: 'Audited business' }]);
    if (path.endsWith('/portfolio')) return json({ clients: [{projectId:'project_test',name:'Audited business',domain:'client.test',lastCrawledAt:audited?'2026-10-20T10:00:00Z':null}], summary: {}, alerts: [] });
    if (path.endsWith('/auto-identify-competitors')) {
      discoveries++;
      return failure ? json({message:'Provider unavailable'},503) : json({businessName:'Audited business',industry:'Fruit export',identifiedAt:'2026-10-20T10:00:00Z',topCompetitors:[
        ...Array.from({length:5},(_,i)=>({domain:`rival-${i+1}.test`,name:`Verified rival ${i+1}`,industry:'Fruit export',description:'Business website checked',verified:true,verificationLevel:'content'})),
        {domain:'unverified.test',name:'Unverified guess',verified:false},
      ]});
    }
    if (path.endsWith('/add-selected-competitors')) {
      const body = route.request().postDataJSON(); selected.push(body);
      tracked = body.competitors.map((c: {domain:string;name:string},i:number)=>({...c,id:`c${i}`,crawlStatus:'PENDING'}));
      return json({success:true,count:tracked.length});
    }
    if (path.endsWith('/ai-visibility/competitors')) return json(tracked);
    return json({},404);
  });
  return { selected, discoveries:()=>discoveries };
}

test('automatically suggests five verified businesses and audits only selected websites',async({page})=>{
  const state=await setup(page);
  await page.goto('/competitor-intelligence');
  await expect(page.getByRole('checkbox',{name:/^Select rival-/})).toHaveCount(5);
  await expect(page.getByText('Unverified guess')).toHaveCount(0);
  await expect(page.getByText('Google ranking positions are not measured yet.',{exact:false})).toBeVisible();
  expect(state.selected).toHaveLength(0);
  await page.getByRole('checkbox',{name:'Select rival-2.test',exact:true}).check();
  await page.getByRole('checkbox',{name:'Select rival-4.test',exact:true}).check();
  await page.getByRole('button',{name:'Audit 2 competitors',exact:true}).click();
  await expect(page.getByText('2 competitors selected.',{exact:false})).toBeVisible();
  expect(state.selected).toEqual([{competitors:[
    {domain:'rival-2.test',name:'Verified rival 2',industry:'Fruit export',description:'Business website checked'},
    {domain:'rival-4.test',name:'Verified rival 4',industry:'Fruit export',description:'Business website checked'},
  ]}]);
  await expect(page.getByRole('tab',{name:'Gaps',exact:true})).toBeVisible();
});

test('waits for a website audit before discovery',async({page})=>{
  const state=await setup(page,false);
  await page.goto('/competitor-intelligence');
  await expect(page.getByText('to find competitors automatically.',{exact:false})).toBeVisible();
  expect(state.discoveries()).toBe(0);
});

test('discovery failure stays explicit and retryable',async({page})=>{
  const state=await setup(page,true,true);
  await page.goto('/competitor-intelligence');
  await expect(page.getByText('Could not find competitors:',{exact:false})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:/^Select/})).toHaveCount(0);
  await page.getByRole('button',{name:'Find again',exact:true}).click();
  await expect.poll(state.discoveries).toBe(2);
});
