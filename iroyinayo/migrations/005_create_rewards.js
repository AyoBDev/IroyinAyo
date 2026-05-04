exports.up = function (knex) {
  return knex.schema
    .createTable('reward_options', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('type').notNullable();
      table.integer('points_cost').notNullable();
      table.string('value').notNullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('redemptions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('reward_option_id').notNullable().references('id').inTable('reward_options').onDelete('CASCADE');
      table.string('status').notNullable().defaultTo('pending');
      table.string('phone_number');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('fulfilled_at');
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('redemptions').dropTableIfExists('reward_options');
};
