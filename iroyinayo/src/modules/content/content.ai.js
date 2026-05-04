const Groq = require('groq-sdk');
const contentService = require('./content.service');

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

  const client = getClient();

  const prompt = buildPrompt(category);

  const completion = await client.chat.completions.create({
    model: 'gemma2-9b-it',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = completion.choices[0].message.content;
  const parsed = parseResponse(text);

  const content = await contentService.create({
    title: parsed.title,
    body: parsed.body,
    source: 'ai',
    categories: [category],
    is_approved: false,
    is_broadcast: false,
  });

  return content;
}

async function generateDailyDigest() {
  const results = [];

  for (const category of CATEGORIES) {
    try {
      const content = await generateContent(category);
      results.push({ category, status: 'success', contentId: content.id });
      console.log(`AI content generated for category: ${category}`);
    } catch (err) {
      results.push({ category, status: 'error', error: err.message });
      console.error(`AI content generation failed for ${category}: ${err.message}`);
    }
  }

  return results;
}

function buildPrompt(category) {
  const categoryDescriptions = {
    scholarships: 'scholarship opportunities, grants, and financial aid available to Nigerian university students',
    entertainment: 'campus entertainment, movies, music, events, and pop culture relevant to Nigerian university students',
    tech: 'technology news, tips, and trends relevant to Nigerian university students (apps, gadgets, coding, AI)',
    sports: 'sports news and updates relevant to Nigerian university students (campus sports, Nigerian football, international sports)',
    campus_news: 'university campus life news, announcements, and updates relevant to University of Ilorin students',
    career: 'career advice, internship opportunities, job tips, and professional development for Nigerian university students',
    health: 'health and wellness tips, mental health awareness, and fitness advice for Nigerian university students',
    academic: 'academic tips, study strategies, exam preparation, and educational resources for Nigerian university students',
  };

  return `You are a content writer for Iroyinayo, a WhatsApp-based information platform for University of Ilorin students in Nigeria.

Write a short, engaging piece of content for the "${category}" category.

Topic focus: ${categoryDescriptions[category]}

Requirements:
- Title: 5-12 words, catchy and informative
- Body: 2-4 short paragraphs, 80-150 words total
- Tone: friendly, informative, relatable to Nigerian university students
- Use simple English, avoid jargon
- Include actionable info or a useful takeaway
- Do NOT use hashtags or emojis
- Make it feel current and relevant

Respond in exactly this format:
TITLE: [your title here]
BODY: [your body text here]`;
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

module.exports = { generateContent, generateDailyDigest, buildPrompt, parseResponse, CATEGORIES };
