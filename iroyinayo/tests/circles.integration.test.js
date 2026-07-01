const db = require('../src/config/database');
const circlesService = require('../src/modules/circles/service');
const poolsService = require('../src/modules/circles/pools.service');
const resolution = require('../src/modules/circles/resolution.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

describe('Circles integration', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('circle_pool_predictions').del();
    await db('circle_pool_resolutions').del();
    await db('circle_pools').del();
    await db('circle_invites').del();
    await db('circle_members').del();
    await db('circles').del();
    await db('students').del();
  });

  test('create circle → invite preview → second user joins → predict → resolve → payouts', async () => {
    const alice = await makeStudent('Alice');
    const bola = await makeStudent('Bola');

    // Alice creates circle
    const { circle, inviteToken } = await circlesService.createCircle('Block A', alice.id);

    // Bola previews
    const preview = await circlesService.previewByToken(inviteToken);
    expect(preview.circleName).toBe('Block A');
    expect(preview.memberCount).toBe(1);

    // Bola joins
    await circlesService.joinCircleByToken(inviteToken, bola.id);

    // Alice creates a private pool
    const pool = await poolsService.createPool(circle.id, alice.id, {
      poolType: 'private', title: 'Q', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 5000),
      stakeAmount: 100,
    });

    // Both predict
    await poolsService.predictInPool(pool.id, { studentId: alice.id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: bola.id }, 'B');

    // Close pool manually (simulating cron)
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });

    // Alice reports A as winner — this triggers immediate payout in our impl
    await resolution.creatorReportResult(pool.id, alice.id, 'A');

    // Force expiry of dispute window and run cron
    await db('circle_pool_resolutions').where({ pool_id: pool.id }).update({ dispute_window_ends_at: new Date(Date.now() - 1000) });
    await resolution.processExpiredDisputeWindows();

    // Verify payouts: Alice predicted A (winner), gets pot 200
    const aliceAfter = await db('students').where({ id: alice.id }).first();
    const bolaAfter = await db('students').where({ id: bola.id }).first();
    expect(aliceAfter.points_balance).toBe(1000 - 100 + 200); // -stake +pot
    expect(bolaAfter.points_balance).toBe(1000 - 100); // -stake, no payout

    // Verify pool is fully resolved
    const finalPool = await db('circle_pools').where({ id: pool.id }).first();
    expect(finalPool.status).toBe('resolved');
    expect(finalPool.winner_outcome).toBe('A');
  });
});
