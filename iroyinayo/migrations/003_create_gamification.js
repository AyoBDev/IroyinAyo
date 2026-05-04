exports.up = function (knex) {
  return knex.schema
    .createTable('point_transactions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.integer('amount').notNullable();
      table.string('type').notNullable();
      table.string('description');
      table.uuid('reference_id');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('streaks', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE').unique();
      table.integer('current_streak').notNullable().defaultTo(0);
      table.integer('longest_streak').notNullable().defaultTo(0);
      table.date('last_active_date');
    })
    .createTable('quizzes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('question').notNullable();
      table.json('options').notNullable();
      table.string('correct_option').notNullable();
      table.string('category');
      table.integer('points_reward').notNullable().defaultTo(10);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('quiz_answers', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('quiz_id').notNullable().references('id').inTable('quizzes').onDelete('CASCADE');
      table.string('selected_option').notNullable();
      table.boolean('is_correct').notNullable();
      table.unique(['student_id', 'quiz_id']);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('quiz_answers')
    .dropTableIfExists('quizzes')
    .dropTableIfExists('streaks')
    .dropTableIfExists('point_transactions');
};
