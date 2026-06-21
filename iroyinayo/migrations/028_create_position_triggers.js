exports.up = async function (knex) {
  await knex.schema.createTable('position_triggers', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('position_id').notNullable().references('id').inTable('multi_market_positions').onDelete('CASCADE');
    table.enu('condition', ['resolution_today', 'resolved_away', 'sharp_move']).notNullable();
    table.timestamp('eligible_at', { useTz: true }).notNullable();
    table.timestamp('fired_at', { useTz: true }).nullable();
    table.enu('surfaced_via', ['wa_daily', 'wa_oneoff', 'in_app_strip']).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['position_id', 'condition'], 'uniq_position_condition');
    table.index(['condition', 'fired_at'], 'idx_triggers_pending');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('position_triggers');
};
