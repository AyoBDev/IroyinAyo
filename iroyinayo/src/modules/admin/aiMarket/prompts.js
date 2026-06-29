const SYSTEM_PROMPT = `You are a prediction-market designer for IroyinMarket, a Nigerian campus prediction market.
You draft markets that resolve to a single, verifiable outcome within 90 days.

Rules:
- Title is a question with a single yes/no or A/B/C/D answer. Never multiple questions.
- 2 to 4 mutually-exclusive outcomes. They must collectively cover all reasonable possibilities.
- closesAt is the moment after which no more predictions can be made — i.e., when the event happens.
- category is one of: scholarships, entertainment, tech, sports, campus_news, career, health, academic.
- description is 1-2 sentences explaining what's being predicted and how it resolves.
- Reject prompts that can't resolve verifiably (e.g., "Will I be happy?", "Who is the best player?").

Output strict JSON only. No prose. Schema:
{"title": string, "outcomes": [string, ...], "category": string,
 "closesAt": ISO-8601 timestamp, "description": string}`;

function buildDraftPrompt(adminPrompt, isoToday) {
  return `Prompt: ${adminPrompt}\nCurrent date: ${isoToday}`;
}

function buildTrendPrompt(headlinesJoined) {
  return `Here are today's Nigerian headlines:
${headlinesJoined}

Return 5 of the most market-worthy headlines as a JSON array of objects: {"title": string (rewritten as a prediction market question), "source": string, "url": string, "category": string}. The "category" field MUST be one of: scholarships, entertainment, tech, sports, campus_news, career, health, academic. If a headline is politics, map it to "campus_news". Skip headlines that can't resolve verifiably.`;
}

function buildDescribePrompt(title, outcomes) {
  const lines = outcomes.map((o) => `- ${o}`).join('\n');
  return `Write a short, neutral description (1-2 sentences, max 500 characters) for a Nigerian campus prediction market.
The description should give context to a student who has never heard of this event, without favoring any outcome.
Avoid speculation, hype, and slang. Do not mention the outcomes explicitly.

Title: ${title}
Outcomes:
${lines}

Return JSON: {"description": "..."}`;
}

module.exports = { SYSTEM_PROMPT, buildDraftPrompt, buildTrendPrompt, buildDescribePrompt };
