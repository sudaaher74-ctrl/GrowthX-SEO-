require('reflect-metadata');
const {PrismaClient}=require('/app/node_modules/@prisma/client');
const Redis=require('/app/node_modules/ioredis');
const {randomUUID}=require('node:crypto');
const {GoogleOAuthService}=require('/app/dist/modules/integrations/google/google-oauth.service');
const {SearchConsoleService}=require('/app/dist/modules/integrations/google/search-console.service');
const {AnalyticsService}=require('/app/dist/modules/integrations/google/analytics.service');
const {AnalyticsReportService}=require('/app/dist/modules/integrations/google/analytics-report.service');
const db=new PrismaClient();
const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:10000});
const owner=randomUUID();
const lock='growthx:google-catchup:lock';
let locked=false;
(async()=>{
 locked=await redis.set(lock,owner,'EX',3600,'NX');
 if(!locked)return;
 const oauth=new GoogleOAuthService(db);
 if(!oauth.configuration().configured)throw new Error('Google OAuth configuration is incomplete');
 const services={search_console:new SearchConsoleService(db,oauth),analytics:new AnalyticsService(db,oauth,new AnalyticsReportService(db,oauth))};
 const rows=await db.integration.findMany({where:{provider:{in:['search_console','analytics']},status:'CONNECTED',selectedResourceId:{not:null},OR:[{lastSyncedAt:null},{lastSyncedAt:{lt:new Date(Date.now()-24*3600000)}}]},select:{id:true,projectId:true,provider:true}});
 for(const row of rows){
  const attemptKey=`growthx:google-catchup:attempt:${row.id}`;
  if(!await redis.set(attemptKey,'1','EX',3600,'NX'))continue;
  try{
   const result=await services[row.provider].sync(row.projectId,{days:28});
   console.log(JSON.stringify({provider:row.provider,projectId:row.projectId,status:result.status,rowsWritten:result.rowsWritten,failedGrains:result.failedGrains||[]}));
  }catch(error){
   const code=error?.response?.data?.error;
   if(code==='invalid_grant'||/\binvalid_grant\b/.test(error.message||''))await oauth.markNeedsReauth(row.projectId,row.provider,'Google rejected the refresh token (invalid_grant).');
   console.error(JSON.stringify({provider:row.provider,projectId:row.projectId,status:'FAILED',needsReconnect:code==='invalid_grant'}));
   process.exitCode=1;
  }
 }
})().catch(()=>{console.error('Google catch-up could not complete; check database, Redis and OAuth configuration.');process.exitCode=1}).finally(async()=>{
 if(locked)await redis.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',1,lock,owner).catch(()=>{});
 await redis.quit().catch(()=>{});await db.$disconnect();
});
