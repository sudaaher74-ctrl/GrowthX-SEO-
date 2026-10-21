import {test,expect} from '@playwright/test';
import {API_BASE} from './api-base';

test('adding a website keeps the new project selected while the directory refreshes',async({page})=>{
 let added=false;
 await page.addInitScript(()=>{localStorage.setItem('growthx.token','test-token');localStorage.setItem('growthx.org','org_test');localStorage.setItem('growthx.project','old');});
 await page.route(`${API_BASE}/**`,async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=(body:unknown)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(path==='/auth/csrf')return json({csrf_token:'test'});
   if(path==='/organizations')return json([{id:'org_test',name:'Test'}]);
   if(path==='/projects/org/org_test'){
     if(added)await new Promise(resolve=>setTimeout(resolve,1200));
     return json([{id:'old',name:'Old website'},...(added?[{id:'new',name:'fresh.test'}]:[])]);
   }
   if(path.endsWith('/portfolio'))return json({clients:[{projectId:'old',name:'Old website',domain:'old.test',trend:[]},...(added?[{projectId:'new',name:'fresh.test',domain:'fresh.test',trend:[]}]:[])],summary:{},alerts:[]});
   if(path==='/api/autopilot'){added=true;return json({id:'run',projectId:'new',domain:'fresh.test',status:'DISCOVERING'});}
   if(path.endsWith('/action-engine/competitors'))return json({competitors:[]});
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 await page.goto('/dashboard');
 await page.getByRole('button',{name:/Old website old.test/}).click();
 await page.getByPlaceholder('Add website, e.g. yoursite.com').fill('fresh.test');
 const refreshed=page.waitForResponse(response=>response.url().endsWith('/projects/org/org_test')&&added);
 await page.getByRole('button',{name:'Add website',exact:true}).click();
 await refreshed;
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('growthx.project'))).toBe('new');
 await expect(page.getByRole('button',{name:/fresh.test fresh.test/})).toBeVisible();
});
