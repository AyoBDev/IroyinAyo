exports.up = async function (knex) {
  // Drop the existing UNIQUE constraint on phone_number before making it nullable.
  // Then re-create it as a partial unique index so nulls are allowed and duplicate
  // non-null phone numbers are still disallowed.
  await knex.schema.alterTable('students', (table) => {
    table.dropUnique(['phone_number']);
  });

  await knex.schema.alterTable('students', (table) => {
    table.string('phone_number').nullable().alter();
    table.uuid('auth_user_id').unique();
    table.string('email').unique();
    table.dropColumn('is_verified');
  });

  // Partial unique index on phone_number (only non-null values must be unique).
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS students_phone_number_unique_not_null
     ON students (phone_number) WHERE phone_number IS NOT NULL`
  );
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS students_phone_number_unique_not_null`);

  await knex.schema.alterTable('students', (table) => {
    table.dropColumn('auth_user_id');
    table.dropColumn('email');
    table.boolean('is_verified').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('students', (table) => {
    table.string('phone_number').notNullable().alter();
    table.unique(['phone_number']);
  });
};
