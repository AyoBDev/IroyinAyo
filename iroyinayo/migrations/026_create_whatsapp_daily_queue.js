exports.up = async function (knex) {
  await knex.schema.createTable('whatsapp_daily_queue', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.timestamp('scheduled_for', { useTz: true }).notNullable();
    table.enu('lede_type', ['rank', 'resolution', 'social', 'curiosity']).nullable();
    table.jsonb('lede_payload').nullable();
    table.jsonb('markets').notNullable().defaultTo('[]');
    table.text('body_text').nullable();
    table.enu('status', ['pending', 'sent', 'failed', 'skipped']).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('last_error').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.index(['scheduled_for', 'status'], 'idx_wa_queue_drain');
    table.index(['student_id', 'scheduled_for'], 'idx_wa_queue_dedupe');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('whatsapp_daily_queue');
};
