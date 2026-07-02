const service = require('../src/modules/admin/circlesAdmin.service');
const db = require('../src/config/database');

describe('circlesAdmin.service', () => {
  beforeAll(async () => {
    // Clean test data
    await db('circle_pool_predictions').del();
    await db('circle_pool_resolutions').del();
    await db('circle_pools').del();
    await db('circle_members').del();
    await db('circle_invites').del();
    await db('circles').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('getOverviewStats', () => {
    it('should return correct counts across time windows', async () => {
      const now = new Date();
      const date7dAgo = new Date(now - 8 * 86400 * 1000); // 8 days ago
      const date30dAgo = new Date(now - 31 * 86400 * 1000); // 31 days ago
      const date5dAgo = new Date(now - 5 * 86400 * 1000); // 5 days ago

      // Create test student
      const [student] = await db('students').insert({
        name: 'Test Student',
        phone_number: '+2341234567890',
        points_balance: 1000,
      }).returning('*');

      // Create circles
      const [circle1] = await db('circles').insert({
        name: 'Circle 1',
        created_by: student.id,
        created_at: date5dAgo,
      }).returning('*');

      const [circle2] = await db('circles').insert({
        name: 'Circle 2',
        created_by: student.id,
        created_at: date7dAgo, // Outside 7d window
      }).returning('*');

      // Create pools for activity tracking
      const [pool1] = await db('circle_pools').insert({
        circle_id: circle1.id,
        creator_id: student.id,
        pool_type: 'private',
        outcome_a_label: 'Yes',
        outcome_b_label: 'No',
        title: 'Test Pool 1',
        kickoff_at: new Date(now.getTime() + 86400 * 1000),
        stake_amount: 50,
        status: 'open',
        created_at: date5dAgo,
      }).returning('*');

      // Create prediction for volume tracking
      await db('circle_pool_predictions').insert({
        pool_id: pool1.id,
        student_id: student.id,
        predicted_outcome: 'Yes',
        points_locked: 50,
        created_at: date5dAgo,
      });

      const stats = await service.getOverviewStats();

      expect(stats.circles7d).toBe(1); // Only circle1 in last 7 days
      expect(stats.circles30d).toBe(2); // Both circles in last 30 days
      expect(stats.circlesAll).toBe(2); // All circles
      expect(stats.activeCirclesWeek).toBeGreaterThanOrEqual(1); // At least circle1 is active
      expect(stats.volume7d).toBe(50); // One prediction of 50 points
      expect(stats.volume30d).toBe(50);
    });
  });

  describe('getDisputes', () => {
    it('should return only pools in disputed status', async () => {
      const now = new Date();

      // Create test student
      const [student] = await db('students').insert({
        name: 'Dispute Student',
        phone_number: '+2341234567891',
        points_balance: 1000,
      }).returning('*');

      // Create circle
      const [circle] = await db('circles').insert({
        name: 'Dispute Circle',
        created_by: student.id,
      }).returning('*');

      // Create disputed pool
      const [disputedPool] = await db('circle_pools').insert({
        circle_id: circle.id,
        creator_id: student.id,
        pool_type: 'private',
        outcome_a_label: 'Yes',
        outcome_b_label: 'No',
        title: 'Disputed Pool',
        kickoff_at: new Date(now.getTime() + 86400 * 1000),
        stake_amount: 100,
        status: 'disputed',
      }).returning('*');

      // Add resolution with dispute
      await db('circle_pool_resolutions').insert({
        pool_id: disputedPool.id,
        source: 'creator',
        resolver_id: student.id,
        winner_outcome: 'Yes',
        dispute_status: 'disputed',
        dispute_reason: 'Outcome was incorrect',
        resolved_at: now,
      });

      // Create predictions
      await db('circle_pool_predictions').insert({
        pool_id: disputedPool.id,
        student_id: student.id,
        predicted_outcome: 'Yes',
        points_locked: 100,
      });

      const disputes = await service.getDisputes();

      expect(disputes.length).toBeGreaterThanOrEqual(1);
      const dispute = disputes.find(d => d.pool_id === disputedPool.id);
      expect(dispute).toBeDefined();
      expect(dispute.circle_name).toBe('Dispute Circle');
      expect(dispute.title).toBe('Disputed Pool');
      expect(dispute.dispute_reason).toBe('Outcome was incorrect');
      expect(dispute.predictions_count).toBe(1);
      expect(dispute.total_pot).toBe(100);
    });
  });

  describe('getAbandonedCandidates', () => {
    it('should filter private pools >4 days old in closed state', async () => {
      const now = new Date();
      const date5dAgo = new Date(now - 5 * 86400 * 1000);

      // Create test student
      const [student] = await db('students').insert({
        name: 'Abandoned Student',
        phone_number: '+2341234567892',
        points_balance: 1000,
      }).returning('*');

      // Create circle
      const [circle] = await db('circles').insert({
        name: 'Abandoned Circle',
        created_by: student.id,
      }).returning('*');

      // Create abandoned pool (closed, private, >4 days, no resolution)
      const [abandonedPool] = await db('circle_pools').insert({
        circle_id: circle.id,
        creator_id: student.id,
        pool_type: 'private',
        outcome_a_label: 'Yes',
        outcome_b_label: 'No',
        title: 'Abandoned Pool',
        kickoff_at: new Date(now.getTime() - 2 * 86400 * 1000),
        stake_amount: 50,
        status: 'closed',
        created_at: date5dAgo,
      }).returning('*');

      await db('circle_pool_predictions').insert({
        pool_id: abandonedPool.id,
        student_id: student.id,
        predicted_outcome: 'Yes',
        points_locked: 50,
      });

      const abandoned = await service.getAbandonedCandidates();

      expect(abandoned.length).toBeGreaterThanOrEqual(1);
      const found = abandoned.find(a => a.pool_id === abandonedPool.id);
      expect(found).toBeDefined();
      expect(found.circle_name).toBe('Abandoned Circle');
      expect(found.title).toBe('Abandoned Pool');
      expect(found.predictions_count).toBe(1);
      expect(found.days_since_closed).toBeGreaterThanOrEqual(4);
    });

    it('should NOT include pools with resolutions', async () => {
      const now = new Date();
      const date5dAgo = new Date(now - 5 * 86400 * 1000);

      const [student] = await db('students').insert({
        name: 'Resolved Student',
        phone_number: '+2341234567893',
        points_balance: 1000,
      }).returning('*');

      const [circle] = await db('circles').insert({
        name: 'Resolved Circle',
        created_by: student.id,
      }).returning('*');

      const [closedPool] = await db('circle_pools').insert({
        circle_id: circle.id,
        creator_id: student.id,
        pool_type: 'private',
        outcome_a_label: 'Yes',
        outcome_b_label: 'No',
        title: 'Resolved Pool',
        kickoff_at: new Date(now.getTime() - 2 * 86400 * 1000),
        stake_amount: 50,
        status: 'closed',
        created_at: date5dAgo,
      }).returning('*');

      // Add resolution
      await db('circle_pool_resolutions').insert({
        pool_id: closedPool.id,
        source: 'creator',
        resolver_id: student.id,
        winner_outcome: 'Yes',
        dispute_status: 'none',
      });

      const abandoned = await service.getAbandonedCandidates();
      const shouldNotFind = abandoned.find(a => a.pool_id === closedPool.id);
      expect(shouldNotFind).toBeUndefined();
    });
  });

  describe('getTopActiveCircles', () => {
    it('should be ordered by volume and include correct member counts', async () => {
      const now = new Date();
      const date5dAgo = new Date(now - 5 * 86400 * 1000);

      const [student1] = await db('students').insert({
        name: 'Top Student 1',
        phone_number: '+2341234567894',
        points_balance: 1000,
      }).returning('*');

      const [student2] = await db('students').insert({
        name: 'Top Student 2',
        phone_number: '+2341234567895',
        points_balance: 1000,
      }).returning('*');

      const [topCircle] = await db('circles').insert({
        name: 'Top Circle',
        created_by: student1.id,
      }).returning('*');

      // Add members
      await db('circle_members').insert([
        { circle_id: topCircle.id, student_id: student1.id, role: 'admin' },
        { circle_id: topCircle.id, student_id: student2.id, role: 'member' },
      ]);

      // Create pool
      const [pool] = await db('circle_pools').insert({
        circle_id: topCircle.id,
        creator_id: student1.id,
        pool_type: 'private',
        outcome_a_label: 'Yes',
        outcome_b_label: 'No',
        title: 'High Volume Pool',
        kickoff_at: new Date(now.getTime() + 86400 * 1000),
        stake_amount: 100,
        status: 'open',
        created_at: date5dAgo,
      }).returning('*');

      // Add predictions
      await db('circle_pool_predictions').insert([
        {
          pool_id: pool.id,
          student_id: student1.id,
          predicted_outcome: 'Yes',
          points_locked: 100,
          created_at: date5dAgo,
        },
        {
          pool_id: pool.id,
          student_id: student2.id,
          predicted_outcome: 'No',
          points_locked: 150,
          created_at: date5dAgo,
        },
      ]);

      const topCircles = await service.getTopActiveCircles(20);

      expect(topCircles.length).toBeGreaterThanOrEqual(1);
      const found = topCircles.find(c => c.circle_id === topCircle.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('Top Circle');
      expect(found.member_count).toBe(2);
      expect(found.pools_7d).toBeGreaterThanOrEqual(1);
      expect(found.volume_7d).toBeGreaterThanOrEqual(250); // At least 100 + 150
      expect(['Top Student 2', 'Top Student 1']).toContain(found.top_predictor_name); // One of the top predictors
    });
  });
});
