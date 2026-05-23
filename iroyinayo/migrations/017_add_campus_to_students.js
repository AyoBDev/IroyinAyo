exports.up = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.string('campus').nullable();
    table.index('campus');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.dropIndex('campus');
    table.dropColumn('campus');
  });
};
