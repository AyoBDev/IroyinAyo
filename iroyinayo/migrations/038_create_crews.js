exports.up = async function (knex) {
  await knex.schema.createTable('crews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 60).notNullable();
    table.uuid('created_by').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    table.index('created_by');
  });

  await knex.schema.createTable('crew_members', (table) => {
    table.uuid('crew_id').notNullable().references('id').inTable('crews').onDelete('CASCADE');
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.string('role').notNullable().defaultTo('member');
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['crew_id', 'student_id']);
    table.index('student_id');
  });

  await knex.schema.createTable('crew_invites', (table) => {
    table.string('token').primary();
    table.uuid('crew_id').notNullable().references('id').inTable('crews').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at');
    table.index(['crew_id', 'revoked_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('crew_invites');
  await knex.schema.dropTableIfExists('crew_members');
  await knex.schema.dropTableIfExists('crews');
};
