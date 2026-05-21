exports.up = function (knex) {
  return knex.schema.createTable('weekly_leaderboards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.date('week_start').notNullable();
    table.date('week_end').notNullable();
    table.uuid('winner_id').references('id').inTable('students').onDelete('SET NULL');
    table.string('winner_name');
    table.integer('winner_profit').notNullable().defaultTo(0);
    table.jsonb('standings').notNullable().defaultTo('[]');
    table.boolean('prize_paid').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['week_start']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('weekly_leaderboards');
};
