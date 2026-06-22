exports.up = async function (knex) {
  await knex.schema.createTable('daily_rank_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.integer('rank').notNullable();
    table.date('snapshot_date').notNullable();
    table.integer('points_balance').notNullable().defaultTo(0);
    table.integer('net_profit_week').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['student_id', 'snapshot_date']);
    table.unique(['student_id', 'snapshot_date']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('daily_rank_snapshots');
};
