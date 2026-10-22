// Run before promoting a frontend release. Uses no credentials or paid AI calls.
const origin=process.argv[2]||'http://localhost:3000';
const project='00000000-0000-0000-0000-000000000000';
(async()=>{
 const health=await fetch(`${origin}/health`,{signal:AbortSignal.timeout(10000)});
 if(!health.ok)throw new Error(`API health returned ${health.status}`);
 const version=await health.json();
 console.log(JSON.stringify({commit:version.commit,healthy:version.status==='ok'}));
 for(const route of ['integrations/google','google/overview','ai-visibility/journey','backlinks/recommendations','backlinks/recommendations/stats']){
  const response=await fetch(`${origin}/api/projects/${project}/${route}`,{signal:AbortSignal.timeout(10000)});
  if(response.status!==401&&response.status!==403)throw new Error(`${route}: expected authentication guard, received HTTP ${response.status}`);
  console.log(`${route}: route present and protected`);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
