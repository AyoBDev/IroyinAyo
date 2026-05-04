exports.up = function (knex) {
  return knex.schema
    .createTable('markets', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('question').notNullable();
      table.text('description');
      table.string('category');
      table.string('status').notNullable().defaultTo('open');
      table.string('outcome');
      table.string('created_by_type').notNullable();
      table.uuid('created_by_id').notNullable();
      table.boolean('is_approved').notNullable().defaultTo(false);
      table.integer('yes_pool').notNullable().defaultTo(0);
      table.integer('no_pool').notNullable().defaultTo(0);
      table.integer('sponsor_bonus').notNullable().defaultTo(0);
      table.timestamp('closes_at').notNullable();
      table.timestamp('resolved_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('market_positions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('market_id').notNullable().references('id').inTable('markets').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.string('side').notNullable();
      table.integer('amount').notNullable();
      table.integer('payout').defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('market_positions')
    .dropTableIfExists('markets');
};
