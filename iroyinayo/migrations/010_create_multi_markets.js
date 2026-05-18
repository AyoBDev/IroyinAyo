exports.up = function (knex) {
  return knex.schema
    .createTable('multi_markets', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('title').notNullable();
      table.string('status').notNullable().defaultTo('open');
      table.integer('liquidity_b').notNullable().defaultTo(100);
      table.uuid('winning_outcome_id');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('resolved_at');
    })
    .createTable('multi_market_outcomes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
      table.string('label').notNullable();
      table.float('shares_sold').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('multi_market_positions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
      table.uuid('outcome_id').notNullable().references('id').inTable('multi_market_outcomes').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.integer('amount').notNullable();
      table.float('shares').notNullable();
      table.integer('payout').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('multi_market_positions')
    .dropTableIfExists('multi_market_outcomes')
    .dropTableIfExists('multi_markets');
};
