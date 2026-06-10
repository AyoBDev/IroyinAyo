async function getFairValues(config) {
  const probs = typeof config.target_probabilities === 'string'
    ? JSON.parse(config.target_probabilities)
    : config.target_probabilities;
  return probs;
}

module.exports = { getFairValues };
