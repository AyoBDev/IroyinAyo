function afterBinaryTrade(marketId, studentId) {
  setImmediate(async () => {
    try {
      const liquidityService = require('./liquidity.service');
      await liquidityService.evaluate(marketId, 'binary', studentId);
    } catch (err) {
      console.error('Liquidity bot error (binary):', err.message);
    }
  });
}

function afterMultiTrade(marketId, studentId) {
  setImmediate(async () => {
    try {
      const liquidityService = require('./liquidity.service');
      await liquidityService.evaluate(marketId, 'multi', studentId);
    } catch (err) {
      console.error('Liquidity bot error (multi):', err.message);
    }
  });
}

module.exports = { afterBinaryTrade, afterMultiTrade };
