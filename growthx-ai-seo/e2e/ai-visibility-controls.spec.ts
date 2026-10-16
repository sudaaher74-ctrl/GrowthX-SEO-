import { test, expect, type Page } from '@playwright/test';
import { setup } from './fixtures/visibility';
import { API_BASE } from './api-base';
test.setTimeout(120_000);

const providers = ['GEMINI', 'OPENAI', 'ANTHROPIC', 'PERPLEXITY'];
async function measured(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await setup(page);
  await page.route(`${API_BASE}/**/ai-visibility/prompts?*`, route => route.fulfill({json:[{
    id:'p1',text:'Stored buyer question',isActive:true,category:'Discovery',latestChecks:providers.map(assistant => ({
      assistant,checkedAt:'2026-10-16T00:00:00Z',cited:true,model:`${assistant}-model`,error:null,
      answerExcerpt:`${assistant} saved excerpt.`,fullAnswer:`${assistant} complete saved answer. ${'Complete evidence. '.repeat(15)}END OF FULL ANSWER`,
    })),
  }]}));
  await page.route(`${API_BASE}/**/competitors`, route => route.fulfill({json:[{id:'r1',domain:'measured-rival.test',name:'Recorded rival',lastAnalyzedAt:'2026-10-15T00:00:00Z'}]}));
  return failures;
}

test('each primary tab opens scan as a modal and preserves its dashboard and URL', async ({page}) => {
  const errors = await measured(page);
  for (const [tab, button, heading] of [
    ['overview','Run New AI Visibility Check','AI Visibility'],
    ['citations','Run Citation Analysis','Citation Intelligence'],
    ['competitors','Run Competitor Analysis','Competitor Intelligence'],
    ['root-cause','Generate New Analysis','Root Cause Analysis'],
  ]) {
    await page.goto(`/ai-visibility?tab=${tab}`);
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
    await page.getByRole('button',{name:button,exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Run AI Visibility check',exact:true});
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}&workflow=open`));
    await dialog.getByRole('button',{name:'Refresh AI Visibility status',exact:true}).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`tab=${tab}$`));
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('every overview model tab, response viewer and response navigation has an honest state',async ({page})=>{
  const errors=await measured(page);
  await page.goto('/ai-visibility?tab=overview');
  for(const [label,provider] of [['Gemini','GEMINI'],['OpenAI','OPENAI'],['Claude','ANTHROPIC'],['Perplexity','PERPLEXITY']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.getByRole('button',{name:'View Saved Response',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Saved AI response',exact:true});
    await expect(dialog).toContainText(`${provider} complete saved answer`);
    await expect(dialog).toContainText('END OF FULL ANSWER');
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
  }
  await page.getByRole('button',{name:'Grok',exact:true}).click();
  await expect(page.getByRole('button',{name:'View Saved Response',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Next response',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Previous response',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'View All Sources',exact:true}).click();
  await expect(page).toHaveURL(/tab=citations/);
  expect(errors).toEqual([]);
});

test('citation sources, five model filters, saved answers and CSV report stay in the citation view',async ({page})=>{
  const errors=await measured(page);
  await page.goto('/ai-visibility?tab=citations&view=classic');
  await expect(page.getByRole('heading',{name:'Citations Trend',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View All Sources →',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Recorded citation sources'})).toContainText('recorded-source.test');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/tab=citations/);
  for(const model of ['gemini','openai','claude','perplexity','grok']) {
    await page.getByRole('button',{name:model,exact:true}).click();
    await page.getByRole('button',{name:'View Saved Response',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Saved AI response'});
    await expect(dialog).toContainText(model==='grok' ? 'No saved response' : 'END OF FULL ANSWER');
    await page.keyboard.press('Escape');
  }
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download Report',exact:true}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe('recorded-citations.csv');
  await expect(page.getByRole('heading',{name:'Citation Intelligence',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('competitor details and root-cause saved-response buttons open the relevant evidence',async ({page})=>{
  const errors=await measured(page);
  await page.goto('/ai-visibility?tab=competitors');
  await expect(page.getByRole('combobox',{name:'Filter metrics'})).toBeDisabled();
  for(const name of ['View Detailed Analysis →','View Analysis']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Competitor evidence'})).toContainText('Recorded rival');
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Review Recorded Action Plan',exact:true}).click();
  await expect(page).toHaveURL(/tab=actions/);
  await page.getByRole('button',{name:'Root Cause Analysis',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Filter severity levels'})).toBeDisabled();
  for(const model of ['Gemini','OpenAI','Claude','Perplexity','Grok']){
    await page.getByRole('button',{name:model,exact:true}).click();
    await page.getByRole('button',{name:'View Saved Response',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Saved AI response'})).toContainText(model==='Grok'?'No saved response':'END OF FULL ANSWER');
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('secondary views share navigation, date filters, project controls and the same scan modal',async ({page})=>{
  const errors=await measured(page);
  await page.goto('/ai-visibility');
  for(const [label,tab] of [['AI Model Visibility','models'],['Prompt Intelligence','prompts'],['Action Center','actions'],['Monitoring History','history'],['Settings','settings'],['Unified Intelligence','unified']]){
    await page.getByText('More Views',{exact:true}).click();
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await expect(page.getByRole('combobox',{name:'Select project'})).toBeVisible();
    await page.getByRole('combobox',{name:'Select date range'}).selectOption('7');
    await page.getByRole('button',{name:'Run New AI Visibility Check',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Run AI Visibility check'})).toBeVisible();
    await page.getByRole('button',{name:'Close scan',exact:true}).click();
    if(tab==='actions')for(const name of ['Open','Resolved','Dismissed','All'])await page.getByRole('button',{name,exact:true}).click();
  }
  expect(errors).toEqual([]);
});

test('adding a prompt handles cancellation, Escape, validation and successful submit in the same view',async ({page})=>{
  await measured(page);
  const submitted:unknown[]=[];
  await page.route(`${API_BASE}/**/ai-visibility/prompts`,async route=>{
    if(route.request().method()==='POST'){submitted.push(route.request().postDataJSON());return route.fulfill({json:{added:1}});}return route.fallback();
  });
  await page.goto('/ai-visibility?tab=prompts');
  for(const dismissal of ['Cancel','Escape']){
    await page.getByRole('button',{name:'Add prompt',exact:true}).click();
    await expect(page.getByRole('button',{name:'Add',exact:true})).toBeDisabled();
    if(dismissal==='Escape')await page.keyboard.press('Escape');else await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Add prompt',exact:true}).click();
  await page.getByRole('textbox',{name:'Customer question'}).fill('Where can I order fresh bread locally?');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(submitted).toEqual([{prompts:[{text:'Where can I order fresh bread locally?',cluster:'custom'}]}]);
  await expect(page).toHaveURL(/tab=prompts/);
});

test('all data requests respect the selected period and legacy layout parameters cannot switch designs',async ({page})=>{
  await measured(page);
  const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/ai-visibility/'))requests.push(request.url());});
  await page.goto('/ai-visibility?tab=citations&view=classic');
  await page.getByRole('combobox',{name:'Select date range'}).selectOption('7');
  await expect.poll(()=>requests.some(url=>url.includes('/citations?days=7'))).toBe(true);
  await expect.poll(()=>requests.some(url=>url.includes('/root-cause?days=7'))).toBe(true);
  await expect.poll(()=>requests.some(url=>url.includes('/prompts?days=7'))).toBe(true);
  await page.getByRole('button',{name:'AI Visibility',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Visibility Trends',exact:true})).toBeVisible();
  await expect(page).not.toHaveURL(/view=/);
});

test('project switching reloads the selected business without changing tabs or the date range',async ({page})=>{
  await measured(page);
  await page.goto('/ai-visibility?tab=citations');
  await page.getByRole('combobox',{name:'Select date range'}).selectOption('14');
  const request=page.waitForRequest(request=>request.url().includes('/projects/project_second/ai-visibility?days=14'));
  await page.getByRole('combobox',{name:'Select project'}).selectOption('project_second');
  await request;
  await expect(page.getByRole('combobox',{name:'Select project'})).toHaveValue('project_second');
  await expect(page.getByRole('combobox',{name:'Select date range'})).toHaveValue('14');
  await expect(page.getByRole('heading',{name:'Citation Intelligence',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/tab=citations/);
});
