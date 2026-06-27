exports.up = async function (knex) {
  await knex.schema.createTable('pending_refills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.integer('amount').notNullable();
    table.timestamp('issued_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('claimed_at').nullable();
    table.date('week_starting').notNullable();
  });

  await knex.raw(
    `CREATE UNIQUE INDEX pending_refills_one_unclaimed_per_student
     ON pending_refills(student_id) WHERE claimed_at IS NULL`
  );

  await knex.raw(
    `CREATE INDEX pending_refills_student_claimed
     ON pending_refills(student_id, claimed_at)`
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pending_refills');
};
