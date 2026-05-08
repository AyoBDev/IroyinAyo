const Groq = require('groq-sdk');
const contentService = require('./content.service');
const { fetchNewsForCategory } = require('./sources');

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];

function getClient() {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY is not configured');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function generateContent(category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${CATEGORIES.join(', ')}`);
  }

  // Fetch real news for this category
  const articles = await fetchNewsForCategory(category);
  const client = getClient();
  const prompt = buildPrompt(category, articles);

  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 1024,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const text = completion.choices[0].message.content;
  const parsed = parseResponse(text);

  // Find source URL from the article that best matches the generated title
  const sourceUrl = findBestSourceUrl(parsed.title, articles);

  const content = await contentService.create({
    title: parsed.title,
    body: parsed.body,
    source: articles.length > 0 ? 'news' : 'ai',
    source_url: sourceUrl,
    categories: [category],
    is_approved: true,
    is_broadcast: false,
  });

  // Auto-publish so content is available for the morning digest
  await contentService.publish(content.id);

  return content;
}

async function generateDailyDigest() {
  const results = [];

  for (const category of CATEGORIES) {
    try {
      const content = await generateContent(category);
      results.push({ category, status: 'success', contentId: content.id });
      console.log(`Content generated for ${category}: "${content.title}" (source: ${content.source})`);
    } catch (err) {
      results.push({ category, status: 'error', error: err.message });
      console.error(`Content generation failed for ${category}: ${err.message}`);
    }
  }

  return results;
}

// --- Prompts ---

const SYSTEM_PROMPT = `You are a content writer for Iroyinayo, a WhatsApp-based information platform for Nigerian university students.

Your job: take real news articles and rewrite them as short, engaging updates for Nigerian university students.

Rules:
- Write in simple, friendly English — no jargon
- Make it relatable to a university student's life
- Include actionable takeaways when possible (deadlines, links, tips)
- No hashtags, no emojis
- If the news isn't relevant to Nigerian students, find the angle that makes it relevant
- Be honest — don't exaggerate or add false information
- Cite the original source naturally in the text when relevant

Format your response EXACTLY as:
TITLE: [5-12 word catchy title]
BODY: [2-4 paragraphs, 80-150 words total]`;

const CATEGORY_CONTEXT = {
  scholarships: 'Focus on deadlines, eligibility, and how to apply. Nigerian students need specific, actionable scholarship info.',
  entertainment: 'Campus entertainment, movies, music, events. Keep it fun and culturally relevant to Nigerian students.',
  tech: 'Tech news that affects students: apps, gadgets, coding, AI tools for studying. Make it practical.',
  sports: 'Sports news relevant to Nigerian students: NUGA games, Super Eagles, Premier League, campus sports.',
  campus_news: 'Nigerian university news, campus developments, academic calendar updates, ASUU, NUC.',
  career: 'Internships, job opportunities, career tips. Focus on what Nigerian graduates actually need.',
  health: 'Health tips for students: mental health, nutrition on a budget, campus clinic info, staying healthy during exams.',
  academic: 'Study tips, exam strategies, CGPA optimization, postgraduate opportunities.',
};

function buildPrompt(category, articles) {
  const context = CATEGORY_CONTEXT[category];

  if (articles.length === 0) {
    // Fallback: no news found, generate from knowledge
    return `Category: ${category}
Context: ${context}

No recent news articles were found for this category. Write an original, helpful piece based on your knowledge. Make it feel current and relevant to Nigerian university students.

Remember: TITLE: and BODY: format.`;
  }

  const newsContext = articles
    .slice(0, 5)
    .map((a, i) => {
      const parts = [`${i + 1}. "${a.title}" (${a.source})`];
      if (a.summary) parts.push(`   ${a.summary.slice(0, 200)}`);
      if (a.url) parts.push(`   URL: ${a.url}`);
      return parts.join('\n');
    })
    .join('\n\n');

  return `Category: ${category}
Context: ${context}

Here are the latest real news articles for this category:

${newsContext}

Pick the MOST relevant and interesting article for Nigerian university students. Rewrite it as a short, engaging update. Add student-relevant context (e.g., "this affects your SIWES placement" or "deadline is next month").

If none are relevant, combine insights from multiple articles into one useful update.

Remember: TITLE: and BODY: format.`;
}

function parseResponse(text) {
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

  if (!titleMatch || !bodyMatch) {
    throw new Error('Failed to parse AI response: unexpected format');
  }

  return {
    title: titleMatch[1].trim(),
    body: bodyMatch[1].trim(),
  };
}

function findBestSourceUrl(title, articles) {
  if (articles.length === 0) return null;
  // Simple: return the first article's URL as the most likely source
  // A more sophisticated approach would use string similarity
  const titleWords = title.toLowerCase().split(/\s+/);
  let bestMatch = articles[0];
  let bestScore = 0;

  for (const article of articles) {
    const articleWords = article.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter((w) => articleWords.includes(w)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = article;
    }
  }

  return bestMatch.url || null;
}

module.exports = { generateContent, generateDailyDigest, buildPrompt, parseResponse, CATEGORIES };
