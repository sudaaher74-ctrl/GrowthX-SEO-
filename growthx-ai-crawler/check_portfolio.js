const axios = require('axios');
async function main() {
  const loginRes = await axios.post('https://growthx-crawler-api.onrender.com/auth/login', {
    email: 'sudarshan@growthx.ai',
    password: 'GrowthX2026!'
  });
  const token = loginRes.data.accessToken;
  const orgId = loginRes.data.user.orgId;
  
  const portRes = await axios.get(`https://growthx-crawler-api.onrender.com/api/organizations/${orgId}/portfolio`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(JSON.stringify(portRes.data.clients, null, 2));
}
main().catch(console.error);
