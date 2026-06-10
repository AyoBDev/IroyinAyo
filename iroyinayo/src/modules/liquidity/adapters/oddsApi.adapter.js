const logger = require('pino')({ name: 'odds-api-adapter' });

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map();
let consecutiveErrors = 0;
let fetchFn = globalThis.fetch;

function _setFetchFn(fn) { fetchFn = fn; }
function _clearCache() { cache.clear(); consecutiveErrors = 0; }

function convertOddsToProbabilities(outcomes) {
  const rawProbs = outcomes.map(o => ({ name: o.name, prob: 1 / o.price }));
  const sum = rawProbs.reduce((acc, o) => acc + o.prob, 0);
  const result = {};
  for (const o of rawProbs) {
    result[o.name] = o.prob / sum;
  }
  return result;
}

async function getFairValues(config) {
  const { odds_api_event_id, odds_api_market_key, target_probabilities } = config;
  const fallback = typeof target_probabilities === 'string'
    ? JSON.parse(target_probabilities)
    : target_probabilities;

  const cacheKey = `${odds_api_event_id}_${odds_api_market_key}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    logger.warn('ODDS_API_KEY not set, using fallback target_probabilities');
    return fallback;
  }

  try {
    const url = `${ODDS_API_BASE}/sports/soccer/events/${odds_api_event_id}/odds?apiKey=${apiKey}&markets=${odds_api_market_key}&oddsFormat=decimal`;
    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`Odds API returned ${response.status}`);
    }

    const data = await response.json();
    const bookmaker = data.bookmakers?.[0];
    if (!bookmaker) {
      throw new Error('No bookmakers in response');
    }

    const market = bookmaker.markets?.find(m => m.key === odds_api_market_key);
    if (!market) {
      throw new Error(`Market key ${odds_api_market_key} not found`);
    }

    const probabilities = convertOddsToProbabilities(market.outcomes);
    cache.set(cacheKey, { data: probabilities, timestamp: Date.now() });
    consecutiveErrors = 0;
    return probabilities;
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors >= 3) {
      logger.warn({ err, consecutiveErrors }, 'Odds API failing repeatedly, using DB fallback');
    } else {
      logger.info({ err }, 'Odds API error, using fallback');
    }
    return fallback;
  }
}

async function listEvents(sport) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  const url = `${ODDS_API_BASE}/sports/${sport}/events?apiKey=${apiKey}`;
  const response = await fetchFn(url);
  if (!response.ok) return [];
  return response.json();
}

module.exports = { getFairValues, convertOddsToProbabilities, listEvents, _setFetchFn, _clearCache };
