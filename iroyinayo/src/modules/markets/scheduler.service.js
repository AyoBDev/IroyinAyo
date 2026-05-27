const cron = require('node-cron');
const db = require('../../config/database');
const multiMarkets = require('./multiMarkets.service');

const activeJobs = new Map();

function parseCronToNext(cronExpression) {
  const interval = cron.schedule(cronExpression, () => {}, { scheduled: false });
  return interval;
}

async function executeSchedule(schedule) {
  const title = schedule.title.replace(/\{date\}/g, new Date().toLocaleDateString('en-NG', {
    weekday: 'short', month: 'short', day: 'numeric',
  }));

  const market = await multiMarkets.createMarket(title, schedule.liquidity_b || null);

  if (schedule.category) {
    await db('multi_markets').where({ id: market.id }).update({ category: schedule.category });
  }

  const outcomes = typeof schedule.outcomes === 'string'
    ? JSON.parse(schedule.outcomes)
    : schedule.outcomes;

  for (const label of outcomes) {
    await multiMarkets.addOutcome(market.id, label.trim());
  }

  await db('scheduled_markets').where({ id: schedule.id }).update({
    last_created_at: new Date(),
  });

  const { notifyNewMarket } = require('../notifications/whatsapp');
  notifyNewMarket(market.id).catch(() => {});

  console.log(`[SCHEDULER] Created market: "${title}" (${outcomes.length} outcomes)`);
  return market;
}

function startSchedule(schedule) {
  if (activeJobs.has(schedule.id)) {
    activeJobs.get(schedule.id).stop();
  }

  if (!cron.validate(schedule.cron_expression)) {
    console.log(`[SCHEDULER] Invalid cron for schedule ${schedule.id}: ${schedule.cron_expression}`);
    return;
  }

  const job = cron.schedule(schedule.cron_expression, () => {
    executeSchedule(schedule).catch(err => {
      console.error(`[SCHEDULER] Failed to create market for schedule ${schedule.id}:`, err.message);
    });
  });

  activeJobs.set(schedule.id, job);
  console.log(`[SCHEDULER] Registered: "${schedule.title}" [${schedule.cron_expression}]`);
}

function stopSchedule(scheduleId) {
  if (activeJobs.has(scheduleId)) {
    activeJobs.get(scheduleId).stop();
    activeJobs.delete(scheduleId);
  }
}

async function loadAllSchedules() {
  const schedules = await db('scheduled_markets').where({ active: true });
  for (const schedule of schedules) {
    startSchedule(schedule);
  }
  console.log(`[SCHEDULER] Loaded ${schedules.length} active schedules`);
}

async function createSchedule({ title, outcomes, cronExpression, category, liquidityB, createdBy }) {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const [schedule] = await db('scheduled_markets')
    .insert({
      title,
      outcomes: JSON.stringify(outcomes),
      cron_expression: cronExpression,
      category: category || null,
      liquidity_b: liquidityB || 25,
      created_by: createdBy || null,
      active: true,
    })
    .returning('*');

  startSchedule(schedule);
  return schedule;
}

async function updateSchedule(id, updates) {
  const existing = await db('scheduled_markets').where({ id }).first();
  if (!existing) throw new Error('Schedule not found');

  const patch = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.outcomes !== undefined) patch.outcomes = JSON.stringify(updates.outcomes);
  if (updates.cronExpression !== undefined) {
    if (!cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }
    patch.cron_expression = updates.cronExpression;
  }
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.liquidityB !== undefined) patch.liquidity_b = updates.liquidityB;
  if (updates.active !== undefined) patch.active = updates.active;

  const [updated] = await db('scheduled_markets').where({ id }).update(patch).returning('*');

  if (updated.active) {
    startSchedule(updated);
  } else {
    stopSchedule(id);
  }

  return updated;
}

async function deleteSchedule(id) {
  stopSchedule(id);
  await db('scheduled_markets').where({ id }).del();
}

async function listSchedules() {
  return db('scheduled_markets').orderBy('created_at', 'desc');
}

async function triggerNow(id) {
  const schedule = await db('scheduled_markets').where({ id }).first();
  if (!schedule) throw new Error('Schedule not found');
  return executeSchedule(schedule);
}

module.exports = {
  loadAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  triggerNow,
  startSchedule,
  stopSchedule,
};
