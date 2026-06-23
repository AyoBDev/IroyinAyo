const db = require('../../src/config/database');
const { approveMarket, rejectMarket } = require('../../src/modules/markets/multiMarkets.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createPendingMarket() {
  const id = uuidv4();
  await db('multi_markets').insert({
    id,
    title: 'Test pending market',
    status: 'pending',
    liquidity_b: 100,
  });
  return id;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({
    id,
    name: 'Test Admin',
    email: `admin-${id.slice(0,8)}@test.com`,
    password_hash: 'x',
    role: 'super_admin',
  });
  return id;
}

describe('approveMarket', () => {
  test('transitions status from pending to open', async () => {
    const marketId = await createPendingMarket();
    const adminId = await createAdmin();
    await approveMarket(marketId, adminId);
    const market = await db('multi_markets').where({ id: marketId }).first();
    expect(market.status).toBe('open');
  });

  test('throws if market is not pending', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const adminId = await createAdmin();
    await expect(approveMarket(marketId, adminId)).rejects.toThrow(/not pending/i);
  });

  test('throws if market does not exist', async () => {
    const adminId = await createAdmin();
    await expect(approveMarket(uuidv4(), adminId)).rejects.toThrow(/not found/i);
  });
});

describe('rejectMarket', () => {
  test('transitions status from pending to rejected', async () => {
    const marketId = await createPendingMarket();
    const adminId = await createAdmin();
    await rejectMarket(marketId, adminId, 'inappropriate content');
    const market = await db('multi_markets').where({ id: marketId }).first();
    expect(market.status).toBe('rejected');
  });

  test('throws if market is not pending', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const adminId = await createAdmin();
    await expect(rejectMarket(marketId, adminId, 'r')).rejects.toThrow(/not pending/i);
  });
});
