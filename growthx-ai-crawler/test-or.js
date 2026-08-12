require('dotenv').config();
async function test() {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [{role: 'user', content: 'hello'}]
    })
  });
  console.log(r.status);
  const data = await r.json();
  console.log(data);
}
test();
