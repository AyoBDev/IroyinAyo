exports.up = async function (knex) {
  await knex.schema.createTable('market_simulations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.timestamp('run_at').notNullable().defaultTo(knex.fn.now());
    table.enu('trigger_type', ['cron', 'event']).notNullable();
    table.integer('paths_run').notNullable().defaultTo(1000);
    table.jsonb('results').notNullable();
    table.decimal('confidence_score', 4, 3).notNullable();
    table.boolean('external_anchor_used').notNullable().defaultTo(false);
    table.jsonb('external_odds');
  });

  await knex.schema.createTable('simulation_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.uuid('simulation_id').notNullable().references('id').inTable('market_simulations').onDelete('CASCADE');
    table.enu('alert_type', ['manipulation', 'stuck', 'early_resolution']).notNullable();
    table.enu('severity', ['low', 'medium', 'high']).notNullable();
    table.jsonb('details').notNullable();
    table.enu('status', ['pending', 'acknowledged', 'acted_on', 'dismissed']).notNullable().defaultTo('pending');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('simulation_alerts');
  await knex.schema.dropTableIfExists('market_simulations');
};
