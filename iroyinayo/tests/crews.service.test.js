const db = require('../src/config/database');
const service = require('../src/modules/crews/service');

async function makeStudent(name = 'Tester') {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true,
    is_verified: true,
    is_banned: false,
    is_system: false,
    points_balance: 1000,
  }).returning('*');
  return s;
}

describe('Crews service', () => {
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

  test('createCrew inserts crew, member as creator, and invite token', async () => {
    const creator = await makeStudent('Alice');
    const { crew, inviteToken } = await service.createCrew('Block A FIFA Boys', creator.id);
    expect(crew.name).toBe('Block A FIFA Boys');
    expect(inviteToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const members = await db('crew_members').where({ crew_id: crew.id });
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('creator');
  });

  test('joinCrewByToken adds member, throws ALREADY_MEMBER on second call', async () => {
    const creator = await makeStudent('Alice');
    const joiner = await makeStudent('Bola');
    const { inviteToken } = await service.createCrew('Crew', creator.id);
    await service.joinCrewByToken(inviteToken, joiner.id);
    await expect(service.joinCrewByToken(inviteToken, joiner.id)).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });

  test('joinCrewByToken throws CREW_FULL at 15 members', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken } = await service.createCrew('Crew', creator.id);
    for (let i = 0; i < 14; i++) {
      const s = await makeStudent(`M${i}`);
      await service.joinCrewByToken(inviteToken, s.id);
    }
    const overflow = await makeStudent('Overflow');
    await expect(service.joinCrewByToken(inviteToken, overflow.id)).rejects.toMatchObject({ code: 'CREW_FULL' });
  });

  test('rotateInviteToken revokes old, issues new', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken: oldToken } = await service.createCrew('Crew', creator.id);
    const { newToken } = await service.rotateInviteToken((await db('crews').first()).id, creator.id);
    expect(newToken).not.toBe(oldToken);
    const joiner = await makeStudent('Bola');
    await expect(service.joinCrewByToken(oldToken, joiner.id)).rejects.toMatchObject({ code: 'INVITE_REVOKED' });
    await expect(service.joinCrewByToken(newToken, joiner.id)).resolves.toBeTruthy();
  });

  test('previewByToken returns crew preview without joining', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken } = await service.createCrew('Crew', creator.id);
    const preview = await service.previewByToken(inviteToken);
    expect(preview.crewName).toBe('Crew');
    expect(preview.memberCount).toBe(1);
    expect(preview.isFull).toBe(false);
  });

  test('creator cannot leave own crew', async () => {
    const creator = await makeStudent('Alice');
    const { crew } = await service.createCrew('Crew', creator.id);
    await expect(service.leaveCrew(crew.id, creator.id)).rejects.toMatchObject({ code: 'CREATOR_CANNOT_LEAVE' });
  });

  test('bootMember requires caller to be creator', async () => {
    const creator = await makeStudent('Alice');
    const m1 = await makeStudent('Bola');
    const m2 = await makeStudent('Tunde');
    const { crew, inviteToken } = await service.createCrew('Crew', creator.id);
    await service.joinCrewByToken(inviteToken, m1.id);
    await service.joinCrewByToken(inviteToken, m2.id);
    await expect(service.bootMember(crew.id, m1.id, m2.id)).rejects.toMatchObject({ code: 'NOT_CREATOR' });
    await service.bootMember(crew.id, creator.id, m2.id);
    const remaining = await db('crew_members').where({ crew_id: crew.id });
    expect(remaining).toHaveLength(2); // creator + m1
  });
});
