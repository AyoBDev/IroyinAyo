const db = require('../src/config/database');
const crewsService = require('../src/modules/crews/service');
const poolsService = require('../src/modules/crews/pools.service');
const resolution = require('../src/modules/crews/resolution.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name, phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

async function setupPool(memberCount, stake = 50) {
  const creator = await makeStudent('Creator');
  const { crew, inviteToken } = await crewsService.createCrew('C', creator.id);
  const members = [creator];
  for (let i = 0; i < memberCount - 1; i++) {
    const s = await makeStudent(`M${i}`);
    await crewsService.joinCrewByToken(inviteToken, s.id);
    members.push(s);
  }
  const pool = await poolsService.createPool(crew.id, creator.id, {
    poolType: 'private', title: 'Q', outcomeA: 'A', outcomeB: 'B',
    kickoffAt: new Date(Date.now() + 1000), stakeAmount: stake,
  });
  return { crew, creator, members, pool };
}

describe('Crew resolution service', () => {
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

  test('3 correct of 5: each correct gets equal split of pot', async () => {
    const { pool, members } = await setupPool(5, 100);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[3].id }, 'B');
    await poolsService.predictInPool(pool.id, { studentId: members[4].id }, 'B');
    // Pot = 500, 3 correct → each gets floor(500/3) = 166. Platform absorbs 2.
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    const result = await resolution.calculateAndApplyPayouts(pool.id, 'A', 'creator', { resolverId: members[0].id });
    expect(result.perWinner).toBe(166);
    expect(result.platformAbsorbed).toBe(2);
    const balances = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    expect(balances[0]).toBe(1000 - 100 + 166);
    expect(balances[1]).toBe(1000 - 100 + 166);
    expect(balances[2]).toBe(1000 - 100 + 166);
    expect(balances[3]).toBe(1000 - 100);
    expect(balances[4]).toBe(1000 - 100);
  });

  test('0 correct of 5: refund all stakes equally', async () => {
    const { pool, members } = await setupPool(5, 100);
    for (let i = 0; i < 5; i++) {
      await poolsService.predictInPool(pool.id, { studentId: members[i].id }, 'A');
    }
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    const result = await resolution.calculateAndApplyPayouts(pool.id, 'B', 'creator', { resolverId: members[0].id });
    expect(result.perWinner).toBe(0);
    expect(result.platformAbsorbed).toBe(0);
    const balances = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    for (const b of balances) expect(b).toBe(1000); // all refunded
  });

  test('idempotent: calling twice does not double-pay', async () => {
    const { pool, members } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'B');
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.calculateAndApplyPayouts(pool.id, 'A', 'creator', { resolverId: members[0].id });
    const balancesAfter1 = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    await resolution.calculateAndApplyPayouts(pool.id, 'A', 'creator', { resolverId: members[0].id });
    const balancesAfter2 = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    expect(balancesAfter2).toEqual(balancesAfter1);
  });

  test('creatorReportResult sets dispute window', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    const res = await db('crew_pool_resolutions').where({ pool_id: pool.id }).first();
    expect(res.source).toBe('creator');
    expect(res.dispute_status).toBe('open_window');
    expect(res.dispute_window_ends_at).toBeTruthy();
  });

  test('raiseDispute freezes pool', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    await resolution.raiseDispute(pool.id, members[1].id, 'I think Wale won');
    const p = await db('crew_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('disputed');
  });

  test('processExpiredDisputeWindows pays out after window passes', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'B');
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    // Force expiry
    await db('crew_pool_resolutions').where({ pool_id: pool.id }).update({ dispute_window_ends_at: new Date(Date.now() - 1000) });
    const result = await resolution.processExpiredDisputeWindows();
    expect(result.resolved).toBeGreaterThanOrEqual(1);
    const p = await db('crew_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('resolved');
  });
});
