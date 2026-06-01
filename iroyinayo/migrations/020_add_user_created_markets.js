exports.up = async function (knex) {
  await knex.schema.alterTable('multi_markets', (table) => {
    table.uuid('created_by').references('id').inTable('students').onDelete('SET NULL');
    table.integer('creator_fee_percent').notNullable().defaultTo(5);
    table.timestamp('closes_at', { useTz: true });
  });

  await knex.schema.createTable('market_reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.string('reason', 500).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['market_id', 'student_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('market_reports');

  await knex.schema.alterTable('multi_markets', (table) => {
    table.dropColumn('created_by');
    table.dropColumn('creator_fee_percent');
    table.dropColumn('closes_at');
  });
};
