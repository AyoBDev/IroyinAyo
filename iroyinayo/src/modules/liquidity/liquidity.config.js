const db = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../utils/errors');

function validateProbabilities(probs) {
  if (!probs || typeof probs !== 'object') {
    throw new ValidationError('target_probabilities must be an object');
  }
  const values = Object.values(probs);
  if (values.length < 2) {
    throw new ValidationError('target_probabilities must have at least 2 outcomes');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    throw new ValidationError(`target_probabilities must sum to 1.0 (got ${sum.toFixed(4)})`);
  }
}

async function create({ market_id, multi_market_id, source_type, target_probabilities, odds_api_event_id, odds_api_market_key, drift_threshold, correction_strength, max_correction_amount, cooldown_seconds }) {
  validateProbabilities(target_probabilities);

  const insert = {
    source_type: source_type || 'admin',
    target_probabilities: JSON.stringify(target_probabilities),
    odds_api_event_id: odds_api_event_id || null,
    odds_api_market_key: odds_api_market_key || null,
    market_id: market_id || null,
    multi_market_id: multi_market_id || null,
  };

  if (drift_threshold !== undefined) insert.drift_threshold = drift_threshold;
  if (correction_strength !== undefined) insert.correction_strength = correction_strength;
  if (max_correction_amount !== undefined) insert.max_correction_amount = max_correction_amount;
  if (cooldown_seconds !== undefined) insert.cooldown_seconds = cooldown_seconds;

  const [config] = await db('market_liquidity_config').insert(insert).returning('*');
  return config;
}

async function getByMarketId(marketId) {
  const config = await db('market_liquidity_config').where({ market_id: marketId }).first();
  return config || null;
}

async function getByMultiMarketId(multiMarketId) {
  const config = await db('market_liquidity_config').where({ multi_market_id: multiMarketId }).first();
  return config || null;
}

async function getById(id) {
  const config = await db('market_liquidity_config').where({ id }).first();
  if (!config) throw new NotFoundError('Liquidity config not found');
  return config;
}

async function update(id, fields) {
  if (fields.target_probabilities) {
    validateProbabilities(fields.target_probabilities);
    fields.target_probabilities = JSON.stringify(fields.target_probabilities);
  }
  fields.updated_at = new Date();
  await db('market_liquidity_config').where({ id }).update(fields);
  return getById(id);
}

async function remove(id) {
  const deleted = await db('market_liquidity_config').where({ id }).del();
  if (!deleted) throw new NotFoundError('Liquidity config not found');
}

async function listAll() {
  return db('market_liquidity_config').orderBy('created_at', 'desc');
}

async function updateLastCorrectionAt(id) {
  await db('market_liquidity_config').where({ id }).update({ last_correction_at: new Date(), updated_at: new Date() });
}

module.exports = { create, getByMarketId, getByMultiMarketId, getById, update, remove, listAll, updateLastCorrectionAt, validateProbabilities };
