const db = require('../src/config/database');
const service = require('../src/modules/circles/service');

async function makeStudent(name = 'Tester') {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true,
    is_banned: false,
    is_system: false,
    points_balance: 1000,
  }).returning('*');
  return s;
}

describe('Circles service', () => {
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

  test('createCrew inserts circle, member as creator, and invite token', async () => {
    const creator = await makeStudent('Alice');
    const { circle, inviteToken } = await service.createCircle('Block A FIFA Boys', creator.id);
    expect(circle.name).toBe('Block A FIFA Boys');
    expect(inviteToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const members = await db('circle_members').where({ circle_id: circle.id });
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('creator');
  });

  test('joinCrewByToken adds member, throws ALREADY_MEMBER on second call', async () => {
    const creator = await makeStudent('Alice');
    const joiner = await makeStudent('Bola');
    const { inviteToken } = await service.createCircle('Crew', creator.id);
    await service.joinCircleByToken(inviteToken, joiner.id);
    await expect(service.joinCircleByToken(inviteToken, joiner.id)).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });

  test('joinCrewByToken throws CIRCLE_FULL at 15 members', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken } = await service.createCircle('Crew', creator.id);
    for (let i = 0; i < 14; i++) {
      const s = await makeStudent(`M${i}`);
      await service.joinCircleByToken(inviteToken, s.id);
    }
    const overflow = await makeStudent('Overflow');
    await expect(service.joinCircleByToken(inviteToken, overflow.id)).rejects.toMatchObject({ code: 'CIRCLE_FULL' });
  });

  test('rotateInviteToken revokes old, issues new', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken: oldToken } = await service.createCircle('Crew', creator.id);
    const { newToken } = await service.rotateInviteToken((await db('circles').first()).id, creator.id);
    expect(newToken).not.toBe(oldToken);
    const joiner = await makeStudent('Bola');
    await expect(service.joinCircleByToken(oldToken, joiner.id)).rejects.toMatchObject({ code: 'INVITE_REVOKED' });
    await expect(service.joinCircleByToken(newToken, joiner.id)).resolves.toBeTruthy();
  });

  test('previewByToken returns circle preview without joining', async () => {
    const creator = await makeStudent('Alice');
    const { inviteToken } = await service.createCircle('Crew', creator.id);
    const preview = await service.previewByToken(inviteToken);
    expect(preview.circleName).toBe('Crew');
    expect(preview.memberCount).toBe(1);
    expect(preview.isFull).toBe(false);
  });

  test('creator cannot leave own circle', async () => {
    const creator = await makeStudent('Alice');
    const { circle } = await service.createCircle('Crew', creator.id);
    await expect(service.leaveCircle(circle.id, creator.id)).rejects.toMatchObject({ code: 'CREATOR_CANNOT_LEAVE' });
  });

  test('getCurrentInviteToken returns active token without rotating', async () => {
    const creator = await makeStudent('Alice');
    const { circle, inviteToken } = await service.createCircle('Crew', creator.id);
    const r1 = await service.getCurrentInviteToken(circle.id, creator.id);
    expect(r1.token).toBe(inviteToken);
    // Call twice — same token, no churn
    const r2 = await service.getCurrentInviteToken(circle.id, creator.id);
    expect(r2.token).toBe(inviteToken);
    // The original invite should remain non-revoked
    const invite = await db('circle_invites').where({ token: inviteToken }).first();
    expect(invite.revoked_at).toBeNull();
  });

  test('getCurrentInviteToken issues fresh token if all invites revoked', async () => {
    const creator = await makeStudent('Alice');
    const { circle, inviteToken } = await service.createCircle('Crew', creator.id);
    await db('circle_invites').where({ token: inviteToken }).update({ revoked_at: db.fn.now() });
    const r = await service.getCurrentInviteToken(circle.id, creator.id);
    expect(r.token).not.toBe(inviteToken);
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  test('getCurrentInviteToken rejects non-creators', async () => {
    const creator = await makeStudent('Alice');
    const stranger = await makeStudent('Bola');
    const { circle } = await service.createCircle('Crew', creator.id);
    await expect(service.getCurrentInviteToken(circle.id, stranger.id)).rejects.toMatchObject({ code: 'NOT_CREATOR' });
  });

  test('bootMember requires caller to be creator', async () => {
    const creator = await makeStudent('Alice');
    const m1 = await makeStudent('Bola');
    const m2 = await makeStudent('Tunde');
    const { circle, inviteToken } = await service.createCircle('Crew', creator.id);
    await service.joinCircleByToken(inviteToken, m1.id);
    await service.joinCircleByToken(inviteToken, m2.id);
    await expect(service.bootMember(circle.id, m1.id, m2.id)).rejects.toMatchObject({ code: 'NOT_CREATOR' });
    await service.bootMember(circle.id, creator.id, m2.id);
    const remaining = await db('circle_members').where({ circle_id: circle.id });
    expect(remaining).toHaveLength(2); // creator + m1
  });
});
