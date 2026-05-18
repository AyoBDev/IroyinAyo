const db = require('../src/config/database');
const multiMarketsService = require('../src/modules/markets/multiMarkets.service');
const gamificationService = require('../src/modules/gamification/gamification.service');

describe('Multi-outcome LMSR Service', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db('multi_market_positions').del();
    await db('multi_market_outcomes').del();
    await db('multi_markets').del();
    await db('point_transactions').del();
    await db('students').del();
  });

  describe('Pure math functions', () => {
    describe('calculatePrices', () => {
      test('prices sum to 1 for any number of outcomes', () => {
        const prices3 = multiMarketsService.calculatePrices([0, 0, 0], 100);
        expect(prices3.length).toBe(3);
        const sum3 = prices3.reduce((a, b) => a + b, 0);
        expect(sum3).toBeCloseTo(1, 10);

        const prices5 = multiMarketsService.calculatePrices([0, 0, 0, 0, 0], 100);
        expect(prices5.length).toBe(5);
        const sum5 = prices5.reduce((a, b) => a + b, 0);
        expect(sum5).toBeCloseTo(1, 10);
      });

      test('equal shares produce equal prices (1/N each)', () => {
        const prices3 = multiMarketsService.calculatePrices([10, 10, 10], 100);
        expect(prices3[0]).toBeCloseTo(1 / 3, 10);
        expect(prices3[1]).toBeCloseTo(1 / 3, 10);
        expect(prices3[2]).toBeCloseTo(1 / 3, 10);

        const prices4 = multiMarketsService.calculatePrices([5, 5, 5, 5], 100);
        expect(prices4[0]).toBeCloseTo(0.25, 10);
        expect(prices4[1]).toBeCloseTo(0.25, 10);
        expect(prices4[2]).toBeCloseTo(0.25, 10);
        expect(prices4[3]).toBeCloseTo(0.25, 10);
      });

      test('buying shares increases that outcome\'s price', () => {
        const pricesBefore = multiMarketsService.calculatePrices([0, 0, 0], 100);
        const pricesAfter = multiMarketsService.calculatePrices([50, 0, 0], 100);

        expect(pricesAfter[0]).toBeGreaterThan(pricesBefore[0]);
        expect(pricesAfter[1]).toBeLessThan(pricesBefore[1]);
        expect(pricesAfter[2]).toBeLessThan(pricesBefore[2]);
      });
    });

    describe('calculateCost', () => {
      test('returns positive cost for buying shares', () => {
        const cost = multiMarketsService.calculateCost([0, 0, 0], 100, 0, 10);
        expect(cost).toBeGreaterThan(0);
      });

      test('cost increases with more shares', () => {
        const cost1 = multiMarketsService.calculateCost([0, 0, 0], 100, 0, 10);
        const cost2 = multiMarketsService.calculateCost([0, 0, 0], 100, 0, 20);
        expect(cost2).toBeGreaterThan(cost1);
      });

      test('cost increases as existing shares increase', () => {
        const cost1 = multiMarketsService.calculateCost([0, 0, 0], 100, 0, 10);
        const cost2 = multiMarketsService.calculateCost([50, 0, 0], 100, 0, 10);
        expect(cost2).toBeGreaterThan(cost1);
      });
    });

    describe('calculateSharesForAmount', () => {
      test('returns shares whose cost matches the amount', () => {
        const amount = 50;
        const shares = multiMarketsService.calculateSharesForAmount([0, 0, 0], 100, 0, amount);
        const cost = multiMarketsService.calculateCost([0, 0, 0], 100, 0, shares);
        expect(cost).toBeCloseTo(amount, 1);
      });

      test('works with existing shares', () => {
        const amount = 30;
        const shares = multiMarketsService.calculateSharesForAmount([20, 10, 5], 100, 1, amount);
        const cost = multiMarketsService.calculateCost([20, 10, 5], 100, 1, shares);
        expect(cost).toBeCloseTo(amount, 1);
      });
    });

    describe('logSumExp', () => {
      test('computes stable ln(sum(e^vi))', () => {
        const result = multiMarketsService.logSumExp([0, 0, 0]);
        expect(result).toBeCloseTo(Math.log(3), 10);

        const result2 = multiMarketsService.logSumExp([1, 2, 3]);
        const expected = Math.log(Math.exp(1) + Math.exp(2) + Math.exp(3));
        expect(result2).toBeCloseTo(expected, 10);
      });
    });
  });

  describe('Database operations', () => {
    describe('createMarket', () => {
      test('creates market with correct defaults', async () => {
        const market = await multiMarketsService.createMarket('Who will win 2027 election?');
        expect(market.title).toBe('Who will win 2027 election?');
        expect(market.status).toBe('open');
        expect(market.liquidity_b).toBe(100);
        expect(market.id).toBeDefined();
      });

      test('creates market with custom liquidity', async () => {
        const market = await multiMarketsService.createMarket('Custom liquidity market', 200);
        expect(market.liquidity_b).toBe(200);
      });
    });

    describe('addOutcome', () => {
      test('adds outcome to market', async () => {
        const market = await multiMarketsService.createMarket('Who will win?');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Candidate A');
        expect(outcome.label).toBe('Candidate A');
        expect(outcome.market_id).toBe(market.id);
        expect(outcome.shares_sold).toBe(0);
      });

      test('rejects adding outcome to non-existent market', async () => {
        await expect(
          multiMarketsService.addOutcome('00000000-0000-0000-0000-000000000000', 'Test')
        ).rejects.toThrow('Market not found');
      });

      test('rejects adding outcome to resolved market', async () => {
        const market = await multiMarketsService.createMarket('Resolved market');
        const outcome1 = await multiMarketsService.addOutcome(market.id, 'Option 1');
        await db('multi_markets').where({ id: market.id }).update({ status: 'resolved' });

        await expect(
          multiMarketsService.addOutcome(market.id, 'Option 2')
        ).rejects.toThrow('Market is not open');
      });
    });

    describe('removeOutcome', () => {
      test('removes outcome when no bets exist', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option to remove');

        await multiMarketsService.removeOutcome(market.id, outcome.id);

        const outcomes = await db('multi_market_outcomes').where({ id: outcome.id });
        expect(outcomes.length).toBe(0);
      });

      test('rejects removing outcome with existing bets', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option with bets');

        const [testStudent] = await db('students').insert({
          phone_number: '5555555555',
          name: 'Test Student',
          points_balance: 100,
        }).returning('*');

        await db('multi_market_positions').insert({
          market_id: market.id,
          outcome_id: outcome.id,
          student_id: testStudent.id,
          amount: 10,
          shares: 5,
        });

        await expect(
          multiMarketsService.removeOutcome(market.id, outcome.id)
        ).rejects.toThrow('Cannot remove outcome with existing positions');
      });
    });

    describe('getMarketWithOdds', () => {
      test('returns market with outcomes and computed prices', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        await multiMarketsService.addOutcome(market.id, 'Option A');
        await multiMarketsService.addOutcome(market.id, 'Option B');
        await multiMarketsService.addOutcome(market.id, 'Option C');

        const result = await multiMarketsService.getMarketWithOdds(market.id);

        expect(result.id).toBe(market.id);
        expect(result.outcomes).toHaveLength(3);
        expect(result.outcomes[0].price).toBeCloseTo(1 / 3, 5);
        expect(result.outcomes[1].price).toBeCloseTo(1 / 3, 5);
        expect(result.outcomes[2].price).toBeCloseTo(1 / 3, 5);
      });

      test('computes correct prices after shares are sold', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome1 = await multiMarketsService.addOutcome(market.id, 'Option A');
        const outcome2 = await multiMarketsService.addOutcome(market.id, 'Option B');

        await db('multi_market_outcomes').where({ id: outcome1.id }).update({ shares_sold: 50 });

        const result = await multiMarketsService.getMarketWithOdds(market.id);

        expect(result.outcomes[0].price).toBeGreaterThan(result.outcomes[1].price);
      });
    });

    describe('listOpenMarkets', () => {
      test('lists all open markets with outcomes and prices', async () => {
        const market1 = await multiMarketsService.createMarket('Market 1');
        await multiMarketsService.addOutcome(market1.id, 'Option A');
        await multiMarketsService.addOutcome(market1.id, 'Option B');

        const market2 = await multiMarketsService.createMarket('Market 2');
        await multiMarketsService.addOutcome(market2.id, 'Option X');
        await multiMarketsService.addOutcome(market2.id, 'Option Y');
        await multiMarketsService.addOutcome(market2.id, 'Option Z');

        const markets = await multiMarketsService.listOpenMarkets();

        expect(markets).toHaveLength(2);
        expect(markets[0].outcomes).toBeDefined();
        expect(markets[0].outcomes.length).toBeGreaterThan(0);
      });

      test('excludes resolved markets', async () => {
        const market1 = await multiMarketsService.createMarket('Open market');
        await multiMarketsService.addOutcome(market1.id, 'Option A');

        const market2 = await multiMarketsService.createMarket('Resolved market');
        await multiMarketsService.addOutcome(market2.id, 'Option X');
        await db('multi_markets').where({ id: market2.id }).update({ status: 'resolved' });

        const markets = await multiMarketsService.listOpenMarkets();

        expect(markets).toHaveLength(1);
        expect(markets[0].id).toBe(market1.id);
      });
    });

    describe('buyPosition', () => {
      let student;

      beforeEach(async () => {
        [student] = await db('students').insert({
          phone_number: '1234567890',
          name: 'Test Student',
          points_balance: 100,
        }).returning('*');
      });

      test('deducts points, records shares, updates shares_sold', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option A');
        await multiMarketsService.addOutcome(market.id, 'Option B');

        const result = await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 50);

        expect(result.position.amount).toBe(50);
        expect(result.position.shares).toBeGreaterThan(0);
        expect(result.market.id).toBe(market.id);

        const updatedStudent = await db('students').where({ id: student.id }).first();
        expect(updatedStudent.points_balance).toBe(50);

        const updatedOutcome = await db('multi_market_outcomes').where({ id: outcome.id }).first();
        expect(updatedOutcome.shares_sold).toBeCloseTo(result.position.shares, 5);
      });

      test('rejects when daily refill limit is exhausted', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option A');
        await multiMarketsService.addOutcome(market.id, 'Option B');

        // Exhaust the 3 daily auto-refills
        await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 150);
        await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 150);
        await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 150);

        // 4th attempt should fail because daily refill limit (3) is reached
        await expect(
          multiMarketsService.buyPosition(market.id, outcome.id, student.id, 500)
        ).rejects.toThrow('Daily refill limit reached');
      });

      test('multiple purchases accumulate shares_sold', async () => {
        const market = await multiMarketsService.createMarket('Test market');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option A');
        await multiMarketsService.addOutcome(market.id, 'Option B');

        await gamificationService.addPoints(student.id, 100, 'test', 'Top up');

        await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 30);
        await multiMarketsService.buyPosition(market.id, outcome.id, student.id, 30);

        const updatedOutcome = await db('multi_market_outcomes').where({ id: outcome.id }).first();
        expect(updatedOutcome.shares_sold).toBeGreaterThan(0);
      });
    });

    describe('resolveMarket', () => {
      let student1, student2;

      beforeEach(async () => {
        [student1] = await db('students').insert({
          phone_number: '1111111111',
          name: 'Student 1',
          points_balance: 100,
        }).returning('*');

        [student2] = await db('students').insert({
          phone_number: '2222222222',
          name: 'Student 2',
          points_balance: 100,
        }).returning('*');
      });

      test('pays 1pt per winning share, 0 to losers', async () => {
        const market = await multiMarketsService.createMarket('Election market');
        const outcome1 = await multiMarketsService.addOutcome(market.id, 'Winner');
        const outcome2 = await multiMarketsService.addOutcome(market.id, 'Loser');

        await multiMarketsService.buyPosition(market.id, outcome1.id, student1.id, 40);
        await multiMarketsService.buyPosition(market.id, outcome2.id, student2.id, 40);

        const result = await multiMarketsService.resolveMarket(market.id, outcome1.id);

        expect(result.status).toBe('resolved');
        expect(result.winning_outcome_id).toBe(outcome1.id);

        const winner = await db('students').where({ id: student1.id }).first();
        const loser = await db('students').where({ id: student2.id }).first();

        const winnerPosition = await db('multi_market_positions')
          .where({ student_id: student1.id, outcome_id: outcome1.id })
          .first();

        const expectedPayout = Math.floor(winnerPosition.shares);
        expect(winner.points_balance).toBe(60 + expectedPayout);
        expect(loser.points_balance).toBe(60);
      });

      test('handles fractional shares correctly with floor', async () => {
        const market = await multiMarketsService.createMarket('Fractional test');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Winner');
        await multiMarketsService.addOutcome(market.id, 'Other');

        await db('multi_market_positions').insert({
          market_id: market.id,
          outcome_id: outcome.id,
          student_id: student1.id,
          amount: 25,
          shares: 42.7,
        });

        await multiMarketsService.resolveMarket(market.id, outcome.id);

        const position = await db('multi_market_positions')
          .where({ student_id: student1.id, outcome_id: outcome.id })
          .first();

        expect(position.payout).toBe(42);

        const student = await db('students').where({ id: student1.id }).first();
        expect(student.points_balance).toBe(100 + 42);
      });

      test('updates market status to resolved', async () => {
        const market = await multiMarketsService.createMarket('Status test');
        const outcome = await multiMarketsService.addOutcome(market.id, 'Option');

        await multiMarketsService.resolveMarket(market.id, outcome.id);

        const updatedMarket = await db('multi_markets').where({ id: market.id }).first();
        expect(updatedMarket.status).toBe('resolved');
        expect(updatedMarket.winning_outcome_id).toBe(outcome.id);
        expect(updatedMarket.resolved_at).toBeDefined();
      });
    });

    describe('getStudentPositions', () => {
      let student;

      beforeEach(async () => {
        [student] = await db('students').insert({
          phone_number: '9999999999',
          name: 'Position Student',
          points_balance: 200,
        }).returning('*');
      });

      test('returns positions joined with markets and outcomes', async () => {
        const market1 = await multiMarketsService.createMarket('Market 1');
        const outcome1 = await multiMarketsService.addOutcome(market1.id, 'Option A');
        await multiMarketsService.addOutcome(market1.id, 'Option B');

        const market2 = await multiMarketsService.createMarket('Market 2');
        const outcome2 = await multiMarketsService.addOutcome(market2.id, 'Option X');
        await multiMarketsService.addOutcome(market2.id, 'Option Y');

        await multiMarketsService.buyPosition(market1.id, outcome1.id, student.id, 30);
        await multiMarketsService.buyPosition(market2.id, outcome2.id, student.id, 40);

        const positions = await multiMarketsService.getStudentPositions(student.id);

        expect(positions).toHaveLength(2);
        expect(positions[0].market_title).toBeDefined();
        expect(positions[0].outcome_label).toBeDefined();
        expect(positions[0].amount).toBeDefined();
        expect(positions[0].shares).toBeDefined();
      });

      test('returns empty array for student with no positions', async () => {
        const positions = await multiMarketsService.getStudentPositions(student.id);
        expect(positions).toEqual([]);
      });
    });
  });
});
