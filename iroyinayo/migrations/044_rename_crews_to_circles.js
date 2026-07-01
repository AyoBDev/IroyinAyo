exports.up = async function (knex) {
  // Rename tables
  await knex.schema.renameTable('crews', 'circles');
  await knex.schema.renameTable('crew_members', 'circle_members');
  await knex.schema.renameTable('crew_invites', 'circle_invites');
  await knex.schema.renameTable('crew_pools', 'circle_pools');
  await knex.schema.renameTable('crew_pool_predictions', 'circle_pool_predictions');
  await knex.schema.renameTable('crew_pool_resolutions', 'circle_pool_resolutions');

  // Rename crew_id columns to circle_id
  await knex.schema.alterTable('circle_members', (t) => { t.renameColumn('crew_id', 'circle_id'); });
  await knex.schema.alterTable('circle_invites', (t) => { t.renameColumn('crew_id', 'circle_id'); });
  await knex.schema.alterTable('circle_pools', (t) => { t.renameColumn('crew_id', 'circle_id'); });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('circle_pools', (t) => { t.renameColumn('circle_id', 'crew_id'); });
  await knex.schema.alterTable('circle_invites', (t) => { t.renameColumn('circle_id', 'crew_id'); });
  await knex.schema.alterTable('circle_members', (t) => { t.renameColumn('circle_id', 'crew_id'); });
  await knex.schema.renameTable('circle_pool_resolutions', 'crew_pool_resolutions');
  await knex.schema.renameTable('circle_pool_predictions', 'crew_pool_predictions');
  await knex.schema.renameTable('circle_pools', 'crew_pools');
  await knex.schema.renameTable('circle_invites', 'crew_invites');
  await knex.schema.renameTable('circle_members', 'crew_members');
  await knex.schema.renameTable('circles', 'crews');
};
