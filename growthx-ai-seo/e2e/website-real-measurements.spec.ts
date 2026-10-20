import { expect, test } from "@playwright/test";
import { API_BASE } from "./api-base";

for (const measured of [false, true]) test(`audit counts and ${measured ? "recorded" : "unavailable"} speed measurements`, async ({ page }) => {
  const requests: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("growthx.token", "test-token");
    localStorage.setItem("growthx.org", "org_test");
    localStorage.setItem("growthx.project", "project_test");
  });
  const pages = Array.from({length:58},(_,i)=>({id:`p${i}`,url:`https://example.com/page-${i}`,statusCode:200,indexability:"INDEXABLE",responseTimeMs:1800,title:`Page ${i}`,performance:measured && i===0?{performanceScore:0,lcpMs:1800,inpMs:null,clsScore:0}:null}));
  const issues = Array.from({length:236},(_,i)=>({id:`i${i}`,issueType:"LONG_TITLE",category:"CONTENT",severity:"LOW",description:`Finding ${i}`,affectedUrl:pages[i%58].url}));
  await page.route(`${API_BASE}/**`, async route => {
    const url=new URL(route.request().url()); const path=url.pathname; requests.push(path+url.search);
    const json=(body:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    if(path==="/organizations")return json([{id:"org_test",name:"Test",slug:"test"}]);
    if(path==="/projects/org/org_test")return json([{id:"project_test",name:"Test"}]);
    if(path==="/api/organizations/org_test/portfolio")return json({clients:[{projectId:"project_test",name:"Test",domain:"example.com",trend:[]}],summary:{},alerts:[]});
    if(path.endsWith("/action-engine/competitors"))return json({competitors:[]});
    if(path.endsWith("/latest-crawl"))return json({id:"crawl_test",status:"COMPLETED",healthScore:92,pagesCrawled:58,startedAt:"2026-10-01T00:00:00Z",finishedAt:"2026-10-01T00:01:00Z"});
    if(path.endsWith("/crawl-history"))return json(measured?[{id:"h1",finishedAt:"2026-10-01T00:01:00Z",pagesCrawled:58,issuesFound:236,performance:{pagesMeasured:1,lcpMs:1800,inpMs:null,clsScore:0,performanceScore:0}}]:[]);
    if(path==="/api/crawls/crawl_test/pages")return json({data:pages,meta:{total:58,page:1,totalPages:1}});
    if(path==="/api/crawls/crawl_test/issues"){const p=Number(url.searchParams.get("page")||1);return json({data:issues.slice((p-1)*200,p*200),meta:{total:236,page:p,totalPages:2}});}
    if(path.endsWith("/issues/counts"))return json({openGroups:10,openFindings:236,pagesCrawled:58,bySeverity:{LOW:236}});
    if(path.endsWith("/issues/groups"))return json({groups:[],reachAvailable:false});
    return route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });
  await page.goto("/website?tab=technical-seo");
  await expect(page.getByText("236 findings across 58 audited URLs.",{exact:false})).toBeVisible();
  await expect(page.getByRole("tab",{name:/10 problem types/})).toBeVisible();
  expect(requests.some(r=>r.includes("/issues?page=2&limit=200"))).toBeTruthy();
  await page.getByRole("tab",{name:"Speed",exact:true}).click();
  await expect(page.getByText("Core Web Vitals Trend",{exact:true})).toBeVisible();
  if(measured){
    await expect(page.getByText("0.000",{exact:true}).first()).toBeVisible();
    await expect(page.getByRole("img",{name:"LCP recorded audit measurements"})).toBeVisible();
    await page.getByText("View recorded values",{exact:true}).click();
    await expect(page.getByText(/: 1.8s$/)).toBeVisible();
  }else{
    await expect(page.getByText("Speed measurements unavailable for this audit.",{exact:true})).toBeVisible();
    await expect(page.getByText("No recorded LCP history yet.",{exact:false})).toBeVisible();
  }
  await expect(page.getByText("No real-user INP data recorded",{exact:true})).toBeVisible();
});
