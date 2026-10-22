// Public archive ingestion only. Does not read or publish tenant crawl data.
require('reflect-metadata');
const {existsSync}=require('node:fs');
const compiled=existsSync(require('node:path').join(__dirname,'../dist/modules/backlinks/public-backlink-index.service.js'));
if(!compiled) require('ts-node/register/transpile-only');
const root=compiled?'../dist':'../src';
const {PrismaService}=require(root+'/database/prisma.service');
const {PublicBacklinkIndex}=require(root+'/modules/backlinks/public-backlink-index.service');
const Redis=require('ioredis');
const slices=Number(process.argv[2]??1);
if(!Number.isInteger(slices)||slices<1||slices>1000||!process.env.DATABASE_URL||!process.env.REDIS_URL){
  throw new Error('Set DATABASE_URL and REDIS_URL, then run node scripts/index-public-backlinks.cjs [slices:1..1000]. Existing shared ingestion budgets still apply.');
}
(async()=>{
  const db=new PrismaService(),redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
  const index=new PublicBacklinkIndex(db,{getRedisClient:()=>redis});
  try {
    for(let i=0;i<slices;i++){
      const result=await index.grow();console.log(JSON.stringify(result));
      if(!['COMPLETE','PARTIAL','FAILED'].includes(result.status)) break;
    }
    console.log(JSON.stringify(await index.coverage()));
  } finally {await redis.quit();await db.$disconnect();}
})().catch(error=>{console.error('Public backlink indexing failed: '+error.message);process.exitCode=1;});
