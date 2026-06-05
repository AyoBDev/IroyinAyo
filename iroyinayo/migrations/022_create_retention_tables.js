exports.up = async function (knex) {
  await knex.schema.createTable('market_price_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.jsonb('prices').notNullable();
    table.timestamp('captured_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('market_id');
  });

  await knex.schema.createTable('notification_throttles', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['student_id', 'market_id', 'type']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('notification_throttles');
  await knex.schema.dropTable('market_price_snapshots');
};
