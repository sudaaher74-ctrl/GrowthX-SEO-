const { OpenAI } = require('openai');
require('dotenv').config();

async function run() {
  const client = new OpenAI({
    apiKey: process.env.SARVAM_API_KEY,
    baseURL: 'https://api.sarvam.ai/v1',
    defaultHeaders: { 'api-subscription-key': process.env.SARVAM_API_KEY }
  });

  try {
    const response = await client.chat.completions.create({
      model: 'sarvam-105b',
      messages: [{ role: 'user', content: "What is the market for AI SEO? Write a long essay." }],
      max_tokens: 4000,
    });
    console.log("Finish reason:", response.choices[0].finish_reason);
    console.log("Length:", response.choices[0].message.content.length);
  } catch (err) {
    console.error("API error:", err.message);
  }
}
run();
