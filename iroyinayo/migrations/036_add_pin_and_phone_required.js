exports.up = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.text('pin_hash');
    table.integer('pin_failed_attempts').notNullable().defaultTo(0);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.dropColumn('pin_failed_attempts');
    table.dropColumn('pin_hash');
  });
};
