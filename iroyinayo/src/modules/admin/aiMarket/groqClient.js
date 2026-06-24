const Groq = require('groq-sdk');

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY is not configured');
  }
  return new Groq({ apiKey: key });
}

async function callJSON({ systemPrompt, userPrompt, model = 'llama-3.1-8b-instant', temperature = 0.3, maxTokens = 1024 }) {
  const client = getClient();
  const startedAt = Date.now();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    throw new Error(`groq_unavailable: ${err.message}`);
  }

  const latencyMs = Date.now() - startedAt;
  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('ai_returned_invalid_response: empty completion');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`ai_returned_invalid_response: ${err.message}`);
  }

  return { parsed, model, latencyMs };
}

module.exports = { getClient, callJSON };
