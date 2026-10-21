import { normalizeBrief, repairBrandedBuyerQuestions } from './visibility-workflow.logic';
import { VisibilityContext } from './visibility-workflow.types';
const ctx: VisibilityContext = {gatheredAt:'2026-10-21',businessName:'basecamp.com',domain:'basecamp.com',sources:[],cities:[],keyEvents:null,limitations:[],facts:[{id:'home',source:'website',text:'Basecamp offers project management software, online collaboration tools, mobile apps and desktop apps.'}]};
const draft = () => ({businessName:'Basecamp',summary:'Project collaboration software.',offerings:['Basecamp 5','project management software','online collaboration tools','mobile apps','desktop apps'],locations:[],evidenceIds:['home'],questions:Array.from({length:20},(_,i)=>({text:`What are the Basecamp 5 features for use case ${i+1}?`,offering:'Basecamp 5',location:'',intent:'comparison',rationale:'Product features',evidenceIds:['home']}))});
describe('brand-neutral buyer questions for software sites',()=>{
 it('retains the product catalog but repairs questions using only evidenced neutral categories',()=>{
   const repaired=repairBrandedBuyerQuestions(draft(),ctx);
   const result=normalizeBrief(repaired,ctx,false,20);
   expect(result.offerings).toContain('Basecamp 5');
   expect(new Set(result.questions.map(q=>q.text)).size).toBe(20);
   expect(result.questions.every(q=>!q.text.toLowerCase().includes('basecamp'))).toBe(true);
   expect(result.questions.every(q=>q.evidenceIds.includes('home'))).toBe(true);
   expect(result.locations).toEqual([]);
 });
 it('rejects the draft when no neutral website category is evidenced',()=>{
   const empty={...ctx,facts:[{id:'home',source:'website' as const,text:'Basecamp 5'}]};
   expect(()=>normalizeBrief(repairBrandedBuyerQuestions(draft(),empty),empty,false,20)).toThrow(/must not name/);
 });
});
