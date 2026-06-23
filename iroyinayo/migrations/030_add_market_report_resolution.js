exports.up = async function (knex) {
  await knex.schema.alterTable('market_reports', (table) => {
    table.enu('resolution_status', ['pending', 'dismissed', 'resolved']).notNullable().defaultTo('pending');
    table.text('resolution_note').nullable();
    table.timestamp('resolved_at', { useTz: true }).nullable();
    table.uuid('resolved_by_admin_id').nullable().references('id').inTable('admins').onDelete('SET NULL');
    table.index(['resolution_status', 'created_at'], 'idx_market_reports_pending');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('market_reports', (table) => {
    table.dropIndex(['resolution_status', 'created_at'], 'idx_market_reports_pending');
    table.dropColumn('resolved_by_admin_id');
    table.dropColumn('resolved_at');
    table.dropColumn('resolution_note');
    table.dropColumn('resolution_status');
  });
};
