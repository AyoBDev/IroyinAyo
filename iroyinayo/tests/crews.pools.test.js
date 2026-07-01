const db = require('../src/config/database');
const crewsService = require('../src/modules/crews/service');
const poolsService = require('../src/modules/crews/pools.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

async function makeCrewWithMembers(memberCount) {
  const creator = await makeStudent('Creator');
  const { crew, inviteToken } = await crewsService.createCrew('Test Crew', creator.id);
  const members = [creator];
  for (let i = 0; i < memberCount - 1; i++) {
    const s = await makeStudent(`M${i}`);
    await crewsService.joinCrewByToken(inviteToken, s.id);
    members.push(s);
  }
  return { crew, creator, members };
}

describe('Crew pools service', () => {
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

  test('createPool (private) inserts pool with outcomes', async () => {
    const { crew, creator } = await makeCrewWithMembers(3);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private',
      title: 'Tunde vs Wale FIFA',
      outcomeA: 'Tunde',
      outcomeB: 'Wale',
      kickoffAt: new Date(Date.now() + 3600 * 1000),
      stakeAmount: 50,
    });
    expect(pool.pool_type).toBe('private');
    expect(pool.stake_amount).toBe(50);
    expect(pool.status).toBe('open');
  });

  test('createPool rejects kickoff in the past', async () => {
    const { crew, creator } = await makeCrewWithMembers(2);
    await expect(poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'a', outcomeB: 'b',
      kickoffAt: new Date(Date.now() - 60000), stakeAmount: 50,
    })).rejects.toMatchObject({ code: 'KICKOFF_PAST' });
  });

  test('createPool rejects stake out of range', async () => {
    const { crew, creator } = await makeCrewWithMembers(2);
    await expect(poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'a', outcomeB: 'b',
      kickoffAt: new Date(Date.now() + 3600000), stakeAmount: 5,
    })).rejects.toMatchObject({ code: 'STAKE_INVALID' });
  });

  test('predictInPool deducts points atomically and inserts prediction', async () => {
    const { crew, creator, members } = await makeCrewWithMembers(3);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 3600000), stakeAmount: 100,
    });
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    const s = await db('students').where({ id: members[1].id }).first();
    expect(s.points_balance).toBe(900);
    const pred = await db('crew_pool_predictions').where({ pool_id: pool.id, student_id: members[1].id }).first();
    expect(pred.predicted_outcome).toBe('A');
    expect(pred.points_locked).toBe(100);
  });

  test('predictInPool rejects double prediction', async () => {
    const { crew, creator, members } = await makeCrewWithMembers(3);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 3600000), stakeAmount: 50,
    });
    await poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'A');
    await expect(poolsService.predictInPool(pool.id, { studentId: members[1].id }, 'B'))
      .rejects.toMatchObject({ code: 'ALREADY_PREDICTED' });
  });

  test('predictInPool rejects insufficient points', async () => {
    const poorMember = await makeStudent('Poor', 10);
    const creator = await makeStudent('Creator');
    const { crew, inviteToken } = await crewsService.createCrew('C', creator.id);
    await crewsService.joinCrewByToken(inviteToken, poorMember.id);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 3600000), stakeAmount: 50,
    });
    await expect(poolsService.predictInPool(pool.id, { studentId: poorMember.id }, 'A'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_POINTS' });
    const after = await db('students').where({ id: poorMember.id }).first();
    expect(after.points_balance).toBe(10);
  });

  test('predictInPool rejects non-member', async () => {
    const { crew, creator } = await makeCrewWithMembers(2);
    const outsider = await makeStudent('Outsider');
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 3600000), stakeAmount: 50,
    });
    await expect(poolsService.predictInPool(pool.id, { studentId: outsider.id }, 'A'))
      .rejects.toMatchObject({ code: 'NOT_CREW_MEMBER' });
  });

  test('closeExpiredPools marks past-kickoff pools as closed', async () => {
    const { crew, creator } = await makeCrewWithMembers(2);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'private', title: 'x', outcomeA: 'A', outcomeB: 'B',
      kickoffAt: new Date(Date.now() + 1000), stakeAmount: 50,
    });
    await new Promise(r => setTimeout(r, 1200));
    const result = await poolsService.closeExpiredPools();
    expect(result.closed).toBeGreaterThanOrEqual(1);
    const after = await db('crew_pools').where({ id: pool.id }).first();
    expect(after.status).toBe('closed');
  });
});
