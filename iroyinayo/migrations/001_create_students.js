exports.up = function (knex) {
  return knex.schema
    .createTable('students', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('phone_number').notNullable().unique();
      table.string('name').notNullable();
      table.string('faculty');
      table.string('department');
      table.string('level');
      table.integer('points_balance').notNullable().defaultTo(0);
      table.boolean('is_onboarded').notNullable().defaultTo(false);
      table.boolean('is_banned').notNullable().defaultTo(false);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('student_interests', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.string('category').notNullable();
      table.unique(['student_id', 'category']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('student_interests')
    .dropTableIfExists('students');
};
