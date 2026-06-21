exports.up = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.time('wa_anchor_time').nullable();
    table.boolean('wa_daily_enabled').notNullable().defaultTo(false);
    table.timestamp('wa_paused_until', { useTz: true }).nullable();
    table.integer('wa_failure_count').notNullable().defaultTo(0);
    table.timestamp('last_app_open_at', { useTz: true }).nullable();
    table.index(['wa_daily_enabled', 'wa_paused_until'], 'idx_students_wa_daily_eligible');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.dropIndex(['wa_daily_enabled', 'wa_paused_until'], 'idx_students_wa_daily_eligible');
    table.dropColumn('wa_anchor_time');
    table.dropColumn('wa_daily_enabled');
    table.dropColumn('wa_paused_until');
    table.dropColumn('wa_failure_count');
    table.dropColumn('last_app_open_at');
  });
};
