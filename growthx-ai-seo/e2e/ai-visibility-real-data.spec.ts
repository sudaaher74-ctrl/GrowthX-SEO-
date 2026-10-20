import { test, expect, type Page } from '@playwright/test';
import { API_BASE } from './api-base';

test.beforeEach(async ({page})=>{page.on('pageerror',error=>console.log('Browser error:',error.message,error.stack));});

async function setup(page: Page, options: {empty?:boolean; fail?:boolean}={}) {
  await page.addInitScript(()=>{localStorage.setItem('growthx.session','1');localStorage.setItem('growthx.org','org_test');localStorage.setItem('growthx.project','project_test');});
  await page.route(`${API_BASE}/**`,async route=>{
    const path=new URL(route.request().url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/auth/me') return json({id:'user_test',firstName:'Test',role:'OWNER'});
    if(path==='/organizations') return json([{id:'org_test',name:'Test workspace'}]);
    if(path==='/projects/org/org_test') return json(options.empty?[]:[{id:'project_test',name:'Stored business'}]);
    if(path.endsWith('/portfolio')) return json({clients:[],summary:{},alerts:[]});
    if(path.endsWith('/ai-visibility/journey')) return options.fail?json({message:'Saved analysis unavailable'},503):json({providers:[{provider:'GEMINI',configured:true,model:'fixture-gemini'}],journey:null,answers:[]});
    if(path.includes('/action-engine/') && path.endsWith('/competitors')) return json({competitors:[]});
    if(path.endsWith('/competitors')) return json([]);
    return json({},404);
  });
}

test('one AI Visibility entry has three clear steps and keeps the four main workflow sections',async({page})=>{
  await setup(page);
  await page.goto('/ai-visibility');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab',{name:'1. Review questions'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'2. See results'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'3. Take action'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Prepare my questions'})).toBeVisible();
  await expect(page.getByText('More Views',{exact:true})).toHaveCount(0);
  for(const name of ['Website Audit','Google','Competitor Intelligence','AI Visibility']) await expect(page.getByRole('link',{name:new RegExp(`^${name}`)}).first()).toBeVisible();
});

test('legacy citation and action links enter the same three-step workflow',async({page})=>{
  await setup(page);
  await page.goto('/ai-visibility?tab=citations');
  await expect(page.getByRole('tab',{name:'2. See results'})).toHaveAttribute('aria-selected','true');
  await page.goto('/ai-visibility?tab=root-cause');
  await expect(page.getByRole('tab',{name:'3. Take action'})).toHaveAttribute('aria-selected','true');
});

test('missing projects and API failures remain explicit without demo results',async({page})=>{
  await setup(page,{empty:true});
  await page.goto('/ai-visibility');
  await expect(page.getByText('Choose a business',{exact:true})).toBeVisible();
});

test('failed saved-analysis requests show an error',async({page})=>{
  await setup(page,{fail:true});
  await page.goto('/ai-visibility');
  await expect(page.getByText('Saved analysis unavailable',{exact:false})).toBeVisible();
  await expect(page.getByText('Recommendation rate',{exact:true})).toHaveCount(0);
});
