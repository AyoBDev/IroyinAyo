const db = require('../src/config/database');
const circlesService = require('../src/modules/circles/service');
const poolsService = require('../src/modules/circles/pools.service');
const resolution = require('../src/modules/circles/resolution.service');

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
  const { circle, inviteToken } = await circlesService.createCircle('C', creator.id);
  const members = [creator];
  for (let i = 0; i < memberCount - 1; i++) {
    const s = await makeStudent(`M${i}`);
    await circlesService.joinCircleByToken(inviteToken, s.id);
    members.push(s);
  }
  const pool = await poolsService.createPool(circle.id, creator.id, {
    poolType: 'private', title: 'Q', outcomeA: 'A', outcomeB: 'B',
    kickoffAt: new Date(Date.now() + 1000), stakeAmount: stake,
  });
  return { circle, creator, members, pool };
}

describe('Circle resolution service', () => {
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

  test('3 correct of 5: each correct gets equal split of pot', async () => {
    const { pool, members } = await setupPool(5, 100);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[3].id }, 'B');
    await poolsService.predictInPool(pool.id, { studentId: members[4].id }, 'B');
    // Pot = 500, 3 correct → each gets floor(500/3) = 166. Platform absorbs 2.
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
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
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
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
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.calculateAndApplyPayouts(pool.id, 'A', 'creator', { resolverId: members[0].id });
    const balancesAfter1 = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    await resolution.calculateAndApplyPayouts(pool.id, 'A', 'creator', { resolverId: members[0].id });
    const balancesAfter2 = await Promise.all(members.map(m => db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    expect(balancesAfter2).toEqual(balancesAfter1);
  });

  test('creatorReportResult sets dispute window', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    const res = await db('circle_pool_resolutions').where({ pool_id: pool.id }).first();
    expect(res.source).toBe('creator');
    expect(res.dispute_status).toBe('open_window');
    expect(res.dispute_window_ends_at).toBeTruthy();
  });

  test('raiseDispute freezes pool', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    await resolution.raiseDispute(pool.id, members[1].id, 'I think Wale won');
    const p = await db('circle_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('disputed');
  });

  test('processExpiredDisputeWindows pays out after window passes', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'B');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    // Force expiry
    await db('circle_pool_resolutions').where({ pool_id: pool.id }).update({ dispute_window_ends_at: new Date(Date.now() - 1000) });
    const result = await resolution.processExpiredDisputeWindows();
    expect(result.resolved).toBeGreaterThanOrEqual(1);
    const p = await db('circle_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('resolved');
  });

  test('creatorReportResult does NOT credit balances (deferred payout)', async () => {
    const { pool, members, creator } = await setupPool(3, 100);
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'B');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });

    const balancesBefore = await Promise.all(members.map(m =>
      db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    const balancesAfter = await Promise.all(members.map(m =>
      db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    // Balances unchanged — payouts deferred to window close / admin
    expect(balancesAfter).toEqual(balancesBefore);

    const p = await db('circle_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('awaiting_dispute_window');
    const res = await db('circle_pool_resolutions').where({ pool_id: pool.id }).first();
    expect(res.dispute_status).toBe('open_window');
  });

  test('admin override after dispute does NOT double-credit (points conserved)', async () => {
    const { pool, members, creator } = await setupPool(4, 100);
    // 3 members predict A (creator-reported winner), 1 predicts B (admin-reported winner)
    await poolsService.predictInPool(pool.id, { studentId: members[0].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[3].id }, 'B');

    const balancesAfterStakes = await Promise.all(members.map(m =>
      db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    // Everyone is down 100
    for (const b of balancesAfterStakes) expect(b).toBe(900);

    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    // Dispute window opens — a member disputes
    await resolution.raiseDispute(pool.id, members[3].id, 'I think B actually won');
    const disputed = await db('circle_pools').where({ id: pool.id }).first();
    expect(disputed.status).toBe('disputed');

    // Admin override: B is the true winner
    // Need a super_admin in the students table for the admin_id FK
    const [admin] = await db('students').insert({
      name: 'Admin', phone_number: `admin${Date.now()}`,
      is_onboarded: true, is_banned: false, is_system: false,
      points_balance: 0,
    }).returning('*');
    await resolution.adminOverrideResolution(pool.id, admin.id, 'B', 'B confirmed by replay');

    // Pot = 400. 1 winner. Winner gets 400.
    const finalBalances = await Promise.all(members.map(m =>
      db('students').where({ id: m.id }).first().then(r => r.points_balance)));
    expect(finalBalances[0]).toBe(900); // A-predictor: no payout
    expect(finalBalances[1]).toBe(900);
    expect(finalBalances[2]).toBe(900);
    expect(finalBalances[3]).toBe(900 + 400); // B-predictor: gets entire pot
    // Points-conservation invariant: sum(deltas) === platformAbsorbed (0 here, single winner)
    const totalDelta = finalBalances.reduce((s, b) => s + (b - 1000), 0);
    expect(totalDelta).toBe(0);

    const finalPool = await db('circle_pools').where({ id: pool.id }).first();
    expect(finalPool.status).toBe('resolved');
    expect(finalPool.winner_outcome).toBe('B');
  });

  test('any-member confirmation immediately resolves and pays out', async () => {
    const { pool, members, creator } = await setupPool(3, 100);
    // Members[1] predicts A, members[2] predicts A, creator predicts B (loses)
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: creator.id }, 'B');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');

    const balBefore = await db('students').where({ id: members[1].id }).first().then(r => r.points_balance);

    // members[1] confirms → immediate payout
    await resolution.confirmResolution(pool.id, members[1].id);

    const balAfter = await db('students').where({ id: members[1].id }).first().then(r => r.points_balance);
    expect(balAfter).toBeGreaterThan(balBefore); // received payout
    const p = await db('circle_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('resolved');
  });

  test('creator cannot confirm own report', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await db('circle_pools').where({ id: pool.id }).update({ status: 'closed' });
    await resolution.creatorReportResult(pool.id, creator.id, 'A');
    await expect(resolution.confirmResolution(pool.id, creator.id))
      .rejects.toMatchObject({ code: 'CREATOR_CANNOT_CONFIRM' });
  });

  test('refundAbandonedPools returns stakes to predictors after 7 days', async () => {
    const { pool, members, creator } = await setupPool(3, 50);
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await poolsService.predictInPool(pool.id, { studentId: members[2].id }, 'B');
    await db('circle_pools').where({ id: pool.id }).update({
      status: 'closed',
      created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000), // 8 days ago
    });
    const balBefore = await db('students').where({ id: members[1].id }).first().then(r => r.points_balance);
    const result = await resolution.refundAbandonedPools();
    expect(result.refunded).toBeGreaterThanOrEqual(1);
    const balAfter = await db('students').where({ id: members[1].id }).first().then(r => r.points_balance);
    expect(balAfter).toBe(balBefore + 50);
    const p = await db('circle_pools').where({ id: pool.id }).first();
    expect(p.status).toBe('resolved');
    expect(p.winner_outcome).toBe('abandoned');
  });
});
