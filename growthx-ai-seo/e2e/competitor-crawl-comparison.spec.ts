import {test,expect} from '@playwright/test';
import {API_BASE} from './api-base';

test('completed competitor crawls populate comparisons and close discovery across reloads',async({page})=>{
  let complete=false;let discoveries=0;
  await page.addInitScript(()=>{localStorage.setItem('growthx.token','test-token');localStorage.setItem('growthx.org','org_test');localStorage.setItem('growthx.project','project_test');});
  await page.route(`${API_BASE}/**`,async route=>{
    const path=new URL(route.request().url()).pathname;
    const json=(body:unknown)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/organizations')return json([{id:'org_test',name:'Test',slug:'test'}]);
    if(path==='/projects/org/org_test')return json([{id:'project_test',name:'Test'}]);
    if(path.endsWith('/portfolio'))return json({clients:[{projectId:'project_test',name:'Test',domain:'client.test',lastCrawledAt:'2026-10-01T00:01:00Z',trend:[]}],summary:{},alerts:[]});
    if(path.endsWith('/action-engine/competitors'))return json({competitors:[]});
    if(path.endsWith('/auto-identify-competitors')){discoveries++;return json({topCompetitors:[]});}
    if(path.endsWith('/ai-visibility/competitors'))return json([{id:'r1',name:'Recorded rival',domain:'rival.test',crawlStatus:complete?'COMPLETED':'RUNNING',pagesCrawled:complete?48:undefined,healthScore:complete?96:null,lastAnalyzedAt:complete?'2026-10-01T01:01:00Z':null}]);
    if(path.endsWith('/latest-crawl'))return json({id:'own',status:'COMPLETED',pagesCrawled:58,healthScore:92,finishedAt:'2026-10-01T00:01:00Z'});
    if(path==='/api/crawls/own/pages')return json({data:[],meta:{total:0,page:1,totalPages:0}});
    if(path.endsWith('/competitors/websites'))return json({sites:[]});
    if(path.endsWith('/pages'))return json([]);
    if(path.endsWith('/rival-advantages'))return json({rivals:[]});
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('/competitor-intelligence');
  await expect(page.getByText('Still reading their website',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Choose your competitors',exact:true})).toHaveCount(0);
  complete=true;
  await expect(page.getByRole('cell',{name:'48 pages',exact:true})).toBeVisible({timeout:15000});
  await expect(page.getByRole('cell',{name:'96/100',exact:true})).toBeVisible();
  await expect(page.getByText('Beats you on: Website health score',{exact:true})).toBeVisible();
  await expect(page.getByText('Not measured',{exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('cell',{name:'48 pages',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Choose your competitors',exact:true})).toHaveCount(0);
  expect(discoveries).toBe(0);
});
