exports.up = function (knex) {
  return knex.schema.createTable('scheduled_markets', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('title').notNullable();
    table.jsonb('outcomes').notNullable();
    table.string('category').nullable();
    table.string('cron_expression').notNullable();
    table.integer('liquidity_b').defaultTo(100);
    table.boolean('active').defaultTo(true);
    table.timestamp('last_created_at').nullable();
    table.timestamp('next_run_at').nullable();
    table.uuid('created_by').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('scheduled_markets');
};
