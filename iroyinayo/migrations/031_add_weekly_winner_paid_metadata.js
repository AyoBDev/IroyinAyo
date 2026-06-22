exports.up = async function (knex) {
  await knex.schema.alterTable('weekly_leaderboards', (table) => {
    table.timestamp('paid_at', { useTz: true }).nullable();
    table.uuid('paid_by_admin_id').nullable().references('id').inTable('admins').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('weekly_leaderboards', (table) => {
    table.dropColumn('paid_by_admin_id');
    table.dropColumn('paid_at');
  });
};
