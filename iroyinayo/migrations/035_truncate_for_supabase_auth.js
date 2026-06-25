exports.up = async function (knex) {
  // CASCADE truncates every table with an FK to students.
  // RESTART IDENTITY is a no-op for UUID PKs but harmless.
  await knex.raw('TRUNCATE TABLE students RESTART IDENTITY CASCADE');
};

exports.down = async function () {
  // Truncation is not reversible. No-op down so the migration is forward-only.
};
