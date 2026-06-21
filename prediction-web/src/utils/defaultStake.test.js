import assert from 'node:assert';
import { computeDefaultStake, computeEffectiveCeiling } from './defaultStake.js';

// Test computeDefaultStake
assert.strictEqual(computeDefaultStake({ recentStakes: [], balance: 1000 }), 100, 'balance 1000 should default to 100');
assert.strictEqual(computeDefaultStake({ recentStakes: [], balance: 5000 }), 200, 'balance 5000 should default to 200');
assert.strictEqual(computeDefaultStake({ recentStakes: [], balance: 50 }), 50, 'balance 50 should auto-shrink to 50');
assert.strictEqual(computeDefaultStake({ recentStakes: [], balance: 25 }), 0, 'balance 25 should return 0');

// Test computeEffectiveCeiling
assert.strictEqual(computeEffectiveCeiling(1000), 100, 'ceiling for 1000 should be 100');
assert.strictEqual(computeEffectiveCeiling(5000), 500, 'ceiling for 5000 should be 500');
assert.strictEqual(computeEffectiveCeiling(50), 50, 'ceiling for 50 should be 50');
assert.strictEqual(computeEffectiveCeiling(25), 0, 'ceiling for 25 should be 0');

console.log('All tests passed!');
