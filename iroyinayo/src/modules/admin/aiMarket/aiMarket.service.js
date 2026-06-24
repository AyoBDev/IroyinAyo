const db = require('../../../config/database');
const multiMarkets = require('../../markets/multiMarkets.service');
const sources = require('../../content/sources');
const prompts = require('./prompts');
const validation = require('./validation');
const trendCache = require('./trendCache');
const rateLimit = require('./rateLimit');
const groqClient = require('./groqClient');

const DRAFT_MAX_TOKENS = 1024;
const TRENDS_MAX_TOKENS = 1500;
const HEADLINE_LIMIT = 30;

class StructuredError extends Error {
  constructor(code, message, details) {
    super(`${code}: ${message || code}`);
    this.code = code;
    this.details = details;
  }
}

async function draftMarket({ adminId, prompt, callJSONFn }) {
  const limitCheck = rateLimit.consume(adminId);
  if (!limitCheck.ok) {
    const err = new StructuredError('rate_limit_exceeded', 'rate limit exceeded');
    err.retryAfterSeconds = limitCheck.retryAfterSeconds;
    throw err;
  }

  const promptCheck = validation.validatePrompt(prompt);
  if (!promptCheck.ok) {
    throw new StructuredError('invalid_prompt', promptCheck.error);
  }

  const isoToday = new Date().toISOString().slice(0, 10);
  const userPrompt = prompts.buildDraftPrompt(prompt.trim(), isoToday);
  const callJSON = callJSONFn || groqClient.callJSON;

  let result;
  try {
    result = await callJSON({
      systemPrompt: prompts.SYSTEM_PROMPT,
      userPrompt,
      maxTokens: DRAFT_MAX_TOKENS,
    });
  } catch (err) {
    if (err.message.startsWith('groq_unavailable')) throw new StructuredError('groq_unavailable', err.message);
    if (err.message.startsWith('ai_returned_invalid_response')) throw new StructuredError('ai_returned_invalid_response', err.message);
    if (err.message === 'GROQ_API_KEY is not configured') throw new StructuredError('groq_not_configured', err.message);
    throw err;
  }

  const draftCheck = validation.validateDraft(result.parsed);
  if (!draftCheck.ok) {
    throw new StructuredError('ai_returned_invalid_draft', draftCheck.error, { field: draftCheck.field });
  }

  return {
    ...result.parsed,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

async function publishMarket(draft) {
  const check = validation.validateDraft(draft);
  if (!check.ok) {
    throw new StructuredError('invalid_draft', check.error, { field: check.field });
  }

  const market = await multiMarkets.createMarket(draft.title, null, null);
  try {
    await db('multi_markets').where({ id: market.id }).update({
      category: draft.category,
      description: draft.description || null,
      closes_at: new Date(draft.closesAt),
    });

    for (const label of draft.outcomes) {
      if (label.trim()) {
        await multiMarkets.addOutcome(market.id, label.trim());
      }
    }

    await multiMarkets.seedMarketLiquidity(market.id);
  } catch (err) {
    // Roll back the orphan market row so consumers never see a half-built market.
    // FK cascade removes any outcomes that were added before failure.
    await db('multi_markets').where({ id: market.id }).del().catch((delErr) => {
      console.error('aiMarket.publishMarket: rollback delete failed', delErr);
    });
    throw err;
  }

  return { marketId: market.id, title: draft.title, status: 'open' };
}

async function getTrends({ adminId, callJSONFn, fetchAllNewsFn }) {
  const cached = trendCache.get(adminId);
  if (cached) {
    return { ...cached, cached: true };
  }

  const fetchFn = fetchAllNewsFn || sources.fetchAllNews;
  const callJSON = callJSONFn || groqClient.callJSON;

  let allNews;
  let partialFailure = false;
  try {
    allNews = await fetchFn();
  } catch (err) {
    console.error('aiMarket.getTrends: fetchAllNews failed', err);
    partialFailure = true;
    allNews = {};
  }

  // Flatten + trim to top HEADLINE_LIMIT recent items
  const headlines = [];
  for (const arr of Object.values(allNews || {})) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      headlines.push(item);
      if (headlines.length >= HEADLINE_LIMIT) break;
    }
    if (headlines.length >= HEADLINE_LIMIT) break;
  }

  if (headlines.length === 0) {
    const result = { trends: [], fetchedAt: new Date().toISOString(), latencyMs: 0, partialFailure: true };
    return { ...result, cached: false };
  }

  const headlinesJoined = headlines
    .map((h) => `- ${h.title || ''} (${h.source || ''}, ${h.link || ''})`)
    .join('\n');

  const userPrompt = prompts.buildTrendPrompt(headlinesJoined);

  let result;
  try {
    result = await callJSON({
      systemPrompt: prompts.SYSTEM_PROMPT,
      userPrompt,
      maxTokens: TRENDS_MAX_TOKENS,
    });
  } catch (err) {
    throw new StructuredError('groq_unavailable', err.message);
  }

  // The LLM returns either {trends: [...]} or a bare array. Handle both.
  let suggestions = result.parsed;
  if (suggestions && !Array.isArray(suggestions) && Array.isArray(suggestions.trends)) {
    suggestions = suggestions.trends;
  }
  if (!Array.isArray(suggestions)) suggestions = [];

  const valid = suggestions.filter((s) => validation.validateTrendSuggestion(s).ok);

  const out = {
    trends: valid,
    fetchedAt: new Date().toISOString(),
    latencyMs: result.latencyMs,
    partialFailure,
  };
  trendCache.set(adminId, out);
  return { ...out, cached: false };
}

module.exports = { draftMarket, publishMarket, getTrends, StructuredError };
