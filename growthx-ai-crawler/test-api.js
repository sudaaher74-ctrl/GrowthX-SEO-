const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: '2c758215-8aa3-46a1-aef7-1e783718970f', organizationId: '9e4e9899-6344-4920-ad03-38e3dbeed5aa' },
  'super-secret-jwt-key-for-growthx-ai'
);

async function test() {
  console.log('Sending request...');
  const res = await fetch('http://localhost:3001/api/projects/62587e77-4340-49a3-b73b-c7736943758e/market-research/ask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question: 'What is the market for AI SEO?' })
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}
test();
