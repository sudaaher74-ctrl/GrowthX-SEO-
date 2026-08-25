const { OpenAI } = require('openai');
require('dotenv').config();

async function run() {
  const apiKey = process.env.SARVAM_API_KEY;
  console.log("Key length:", apiKey ? apiKey.length : 0);
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.sarvam.ai/v1',
    defaultHeaders: {
      'api-subscription-key': apiKey
    }
  });

  const schema = {
    type: 'object',
    required: ['summary', 'confidence', 'verifiedClaims', 'inferences', 'citationGaps', 'recommendedActions', 'evidenceGaps'],
    properties: {
      summary: { type: 'string', description: 'Comprehensive answer synthesizing the verified claims.' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      verifiedClaims: { type: 'array', items: { type: 'object' } },
      inferences: { type: 'array', items: { type: 'object' } },
      citationGaps: { type: 'array', items: { type: 'object' } },
      recommendedActions: { type: 'array', items: { type: 'object' } },
      evidenceGaps: { type: 'array', items: { type: 'string' } },
    },
  };

  const instructions = `You are a strategic market research analyst.
You MUST respond with ONLY valid JSON matching this schema. Do NOT include markdown backticks, commentary, or surrounding prose.
JSON Schema:
${JSON.stringify(schema, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'sarvam-105b',
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: "What is the market for AI SEO?" }
      ],
      max_tokens: 4000,
      temperature: 0.2
    });
    const text = response.choices[0].message.content;
    console.log("==== RAW TEXT ====");
    console.log(text);
    console.log("==== END RAW TEXT ====");
  } catch (err) {
    console.error("API error:", err.message);
  }
}

run();
