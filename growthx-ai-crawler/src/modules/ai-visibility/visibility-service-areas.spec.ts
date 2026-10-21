import {normalizeBrief, repairUnsupportedServiceAreas} from './visibility-workflow.logic';
import {VisibilityContext} from './visibility-workflow.types';

const context: VisibilityContext = {gatheredAt:'2026-10-21',businessName:'Studio Example',domain:'studio.test',sources:[],cities:[{city:'Paris',country:'France',sessions:20}],keyEvents:null,limitations:[],facts:[
  {id:'home',source:'website',text:'Commercial interiors and office fit-outs in Indore, across India.'},
  {id:'analytics',source:'ga4',text:'Visits from Paris and London.'},
]};
const draft = () => ({businessName:'Studio Example',summary:'Commercial interior services.',offerings:['commercial interiors'],locations:['Indore','Paris'],evidenceIds:['home'],questions:Array.from({length:20},(_,i)=>({text:`Which commercial interiors providers should I compare for project ${i+1} in Paris?`,offering:'commercial interiors',location:'Paris',intent:'comparison',rationale:'Compare providers',evidenceIds:['home']}))});
describe('website-grounded service-area recovery',()=>{
 it('replaces unsupported question geography with evidenced areas and stays strictly valid',()=>{
   const result=normalizeBrief(repairUnsupportedServiceAreas(draft(),context),context,false,20);
   expect(result.locations).toEqual(['Indore']);
   expect(result.questions).toHaveLength(20);
   expect(new Set(result.questions.map(q=>q.text)).size).toBe(20);
   expect(result.questions.every(q=>q.location==='Indore' && q.text.includes('Indore') && !q.text.includes('Paris'))).toBe(true);
   expect(result.questions.every(q=>q.evidenceIds.includes('home'))).toBe(true);
 });
 it('never uses analytics geography when no service area is supported',()=>{
   const nonlocal={...context,facts:[{id:'home',source:'website',text:'We offer commercial interiors and office fit-outs.'},context.facts[1]]};
   const result=normalizeBrief(repairUnsupportedServiceAreas(draft(),nonlocal),nonlocal,false,20);
   expect(result.locations).toEqual([]);
   expect(result.questions.every(q=>q.location==='' && !/Paris|Indore|London/.test(q.text))).toBe(true);
 });
 it('removes an unused invented area without changing supported questions',()=>{
   const raw=draft(); raw.questions=raw.questions.map(q=>({...q,location:'Indore',text:q.text.replace('Paris','Indore')}));
   const result=normalizeBrief(repairUnsupportedServiceAreas(raw,context),context,false,20);
   expect(result.locations).toEqual(['Indore']);
   expect(result.questions.map(q=>q.text)).toEqual(raw.questions.map(q=>q.text));
 });
 it('does not manufacture questions for an unevidenced offering',()=>{
   const raw=draft(); raw.questions[0].offering='space travel';
   expect(()=>normalizeBrief(repairUnsupportedServiceAreas(raw,context),context,false,20)).toThrow();
 });
 it('leaves supported drafts and owner corrections under the existing validator',()=>{
   const raw=draft();raw.locations=['Indore'];raw.questions=raw.questions.map(q=>({...q,location:'Indore',text:q.text.replace('Paris','Indore')}));
   expect(repairUnsupportedServiceAreas(raw,context)).toBe(raw);
   expect(()=>normalizeBrief(draft(),context,false,20)).toThrow('service areas');
   expect(normalizeBrief(draft(),context,true,20).locations).toContain('Paris');
 });
});
