const axios = require('axios');

async function run() {
  console.log("1. Logging in...");
  const loginRes = await axios.post('https://growthx-crawler-api.onrender.com/auth/login', {
    email: 'sudarshan@growthx.ai',
    password: 'GrowthX2026!'
  });
  const token = loginRes.data.accessToken;
  const orgId = loginRes.data.user.orgId;
  const headers = { Authorization: `Bearer ${token}` };

  console.log("2. Creating Project...");
  const projRes = await axios.post('https://growthx-crawler-api.onrender.com/api/projects', {
    name: 'API Test Client',
    orgId: orgId
  }, { headers });
  const projectId = projRes.data.id;

  console.log("3. Registering Website...");
  const webRes = await axios.post('https://growthx-crawler-api.onrender.com/api/portfolio/websites', {
    url: 'https://test-api.com',
    domain: 'test-api.com',
    projectId: projectId
  }, { headers });
  const websiteId = webRes.data.id;

  console.log("4. Starting Crawl...");
  const crawlRes = await axios.post('https://growthx-crawler-api.onrender.com/api/seo/audit/run', {
    domain: 'test-api.com',
    maxDepth: 1,
    maxConcurrency: 1
  }, { headers });
  
  console.log("✅ All API calls succeeded! Crawl started with ID:", crawlRes.data.crawlId);
}

run().catch(err => {
  console.error("❌ API Test Failed:");
  if (err.response) console.error(err.response.data);
  else console.error(err.message);
});
