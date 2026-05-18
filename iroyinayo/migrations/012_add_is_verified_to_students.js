exports.up = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.boolean('is_verified').notNullable().defaultTo(false);
  }).then(() => {
    return knex('students').update({ is_verified: true });
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.dropColumn('is_verified');
  });
};
