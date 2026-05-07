#!/usr/bin/env node
/**
 * Prompt Evaluation Tool
 *
 * Tests prompt quality by running each category N times and scoring outputs.
 *
 * Usage:
 *   node scripts/eval-prompts.js                  # Run all categories, 1 time each
 *   node scripts/eval-prompts.js --runs 3          # Run all categories, 3 times each
 *   node scripts/eval-prompts.js --category tech   # Run only tech category
 *   node scripts/eval-prompts.js --dry-run         # Show prompts without calling API
 *   node scripts/eval-prompts.js --sources         # Test news source fetching only
 */
require('dotenv').config();

const { buildPrompt, parseResponse, CATEGORIES } = require('../src/modules/content/content.ai');
const { fetchNewsForCategory, fetchAllNews } = require('../src/modules/content/sources');

const args = process.argv.slice(2);
const runs = parseInt(getArg('--runs') || '1', 10);
const category = getArg('--category');
const dryRun = args.includes('--dry-run');
const sourcesOnly = args.includes('--sources');

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

// --- Scoring ---

function scoreOutput(parsed, category) {
  const scores = {};

  // Title length (5-12 words)
  const titleWords = parsed.title.split(/\s+/).length;
  scores.title_length = titleWords >= 5 && titleWords <= 12 ? 1 : 0;

  // Body length (80-150 words)
  const bodyWords = parsed.body.split(/\s+/).length;
  scores.body_length = bodyWords >= 60 && bodyWords <= 200 ? 1 : (bodyWords >= 40 ? 0.5 : 0);

  // No emojis
  scores.no_emojis = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/u.test(parsed.body) ? 0 : 1;

  // No hashtags
  scores.no_hashtags = parsed.body.includes('#') ? 0 : 1;

  // Has paragraphs (at least 2)
  const paragraphs = parsed.body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  scores.has_paragraphs = paragraphs.length >= 2 ? 1 : 0.5;

  // Format compliance (had TITLE: and BODY:)
  scores.format = 1; // If we got here, parsing worked

  // Total
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const max = Object.keys(scores).length;

  return { scores, total, max, percent: Math.round((total / max) * 100) };
}

// --- Main ---

async function testSources() {
  console.log('Testing news sources...\n');
  const allNews = await fetchAllNews();

  for (const [cat, articles] of Object.entries(allNews)) {
    console.log(`\n--- ${cat.toUpperCase()} (${articles.length} articles) ---`);
    if (articles.length === 0) {
      console.log('  No articles found!');
      continue;
    }
    for (const a of articles.slice(0, 3)) {
      console.log(`  "${a.title}" (${a.source})`);
      if (a.summary) console.log(`    ${a.summary.slice(0, 100)}...`);
    }
  }
}

async function main() {
  if (sourcesOnly) {
    await testSources();
    return;
  }

  const categories = category ? [category] : CATEGORIES;
  const results = [];

  console.log(`Prompt Eval: ${categories.length} categories x ${runs} runs${dryRun ? ' (DRY RUN)' : ''}\n`);

  for (const cat of categories) {
    console.log(`\n=== ${cat.toUpperCase()} ===`);

    // Fetch real news
    const articles = await fetchNewsForCategory(cat);
    console.log(`  Sources: ${articles.length} articles found`);

    for (let i = 0; i < runs; i++) {
      const prompt = buildPrompt(cat, articles);

      if (dryRun) {
        console.log(`\n  --- Prompt (run ${i + 1}) ---`);
        console.log(prompt.split('\n').map((l) => `  ${l}`).join('\n'));
        continue;
      }

      try {
        const Groq = require('groq-sdk');
        const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await client.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          max_tokens: 1024,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: 'You are a content writer for Iroyinayo, a WhatsApp info platform. Respond in TITLE: and BODY: format.',
            },
            { role: 'user', content: prompt },
          ],
        });

        const text = completion.choices[0].message.content;
        const parsed = parseResponse(text);
        const score = scoreOutput(parsed, cat);

        console.log(`\n  Run ${i + 1}: ${score.percent}% (${score.total}/${score.max})`);
        console.log(`    Title: "${parsed.title}" (${parsed.title.split(/\s+/).length} words)`);
        console.log(`    Body: ${parsed.body.split(/\s+/).length} words, ${parsed.body.split(/\n\s*\n/).length} paragraphs`);

        // Show individual scores
        for (const [key, val] of Object.entries(score.scores)) {
          if (val < 1) console.log(`    WARN: ${key} = ${val}`);
        }

        results.push({ category: cat, run: i + 1, score, title: parsed.title });
      } catch (err) {
        console.log(`  Run ${i + 1}: FAILED - ${err.message}`);
        results.push({ category: cat, run: i + 1, error: err.message });
      }
    }
  }

  if (!dryRun && results.length > 0) {
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const successful = results.filter((r) => r.score);
    if (successful.length === 0) {
      console.log('No successful runs.');
      return;
    }

    const avgScore = successful.reduce((s, r) => s + r.score.percent, 0) / successful.length;
    console.log(`Average score: ${avgScore.toFixed(0)}%`);
    console.log(`Success rate: ${successful.length}/${results.length}`);

    // Per-category breakdown
    const byCategory = {};
    for (const r of successful) {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r.score.percent);
    }
    console.log('\nPer category:');
    for (const [cat, scores] of Object.entries(byCategory)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      console.log(`  ${cat}: ${avg.toFixed(0)}%`);
    }
  }
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
