const db = require('../src/config/database');
const crewsService = require('../src/modules/crews/service');
const poolsService = require('../src/modules/crews/pools.service');
const resolution = require('../src/modules/crews/resolution.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

describe('Crews integration', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('crew_pool_predictions').del();
    await db('crew_pool_resolutions').del();
    await db('crew_pools').del();
    await db('crew_invites').del();
    await db('crew_members').del();
    await db('crews').del();
    await db('students').del();
  });

  test('create crew → invite preview → second user joins → predict → resolve → payouts', async () => {
    const alice = await makeStudent('Alice');
    const bola = await makeStudent('Bola');

    // Alice creates crew
    const { crew, inviteToken } = await crewsService.createCrew('Block A', alice.id);

    // Bola previews
    const preview = await crewsService.previewByToken(inviteToken);
    expect(preview.crewName).toBe('Block A');
    expect(preview.memberCount).toBe(1);

    // Bola joins
    await crewsService.joinCrewByToken(inviteToken, bola.id);

    // Alice creates a private pool
    const pool = await poolsService.createPool(crew.id, alice.id, {
      poolType: 'private', title: 'Q', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 5000),
      stakeAmount: 100,
    });

    // Both predict
    await poolsService.predictInPool(pool.id, { studentId: alice.id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: bola.id }, 'B');

    // Close pool manually (simulating cron)
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });

    // Alice reports A as winner — this triggers immediate payout in our impl
    await resolution.creatorReportResult(pool.id, alice.id, 'A');

    // Force expiry of dispute window and run cron
    await db('crew_pool_resolutions').where({ pool_id: pool.id }).update({ dispute_window_ends_at: new Date(Date.now() - 1000) });
    await resolution.processExpiredDisputeWindows();

    // Verify payouts: Alice predicted A (winner), gets pot 200
    const aliceAfter = await db('students').where({ id: alice.id }).first();
    const bolaAfter = await db('students').where({ id: bola.id }).first();
    expect(aliceAfter.points_balance).toBe(1000 - 100 + 200); // -stake +pot
    expect(bolaAfter.points_balance).toBe(1000 - 100); // -stake, no payout

    // Verify pool is fully resolved
    const finalPool = await db('crew_pools').where({ id: pool.id }).first();
    expect(finalPool.status).toBe('resolved');
    expect(finalPool.winner_outcome).toBe('A');
  });
});
