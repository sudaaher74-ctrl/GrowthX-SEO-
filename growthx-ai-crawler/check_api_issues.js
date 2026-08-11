const axios = require('axios');
async function main() {
  const loginRes = await axios.post('https://growthx-crawler-api.onrender.com/auth/login', {
    email: 'sudarshan@growthx.ai',
    password: 'GrowthX2026!'
  });
  const token = loginRes.data.accessToken;
  const id = 'ee0934e9-9ac3-412f-a4aa-4c5e72e3e8a3'; // milquufresh.in crawl ID
  const issuesRes = await axios.get(`https://growthx-crawler-api.onrender.com/api/crawls/${id}/issues`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(JSON.stringify(issuesRes.data, null, 2));
}
main().catch(console.error);
