import {test,expect} from '@playwright/test';
// Business Profile was removed from the four-module product. These old URLs
// must not resurrect stored review or post fixtures as if the feature is live.
for(const route of ['/google-business-profile','/reports/business-profile'])test(`retired Business Profile route ${route} is unavailable`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('growthx.token','test-token'));
 await page.goto(route);
 await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
});
