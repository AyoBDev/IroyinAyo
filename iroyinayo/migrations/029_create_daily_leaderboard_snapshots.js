exports.up = async function (knex) {
  await knex.schema.createTable('weekly_leaderboard', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.integer('rank').notNullable();
    table.date('week_start').notNullable();
    table.integer('points').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['student_id', 'week_start']);
    table.unique(['student_id', 'week_start']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('weekly_leaderboard');
};
