exports.up = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.boolean('is_ambassador').notNullable().defaultTo(false);
    table.integer('markets_created').notNullable().defaultTo(0);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.dropColumn('is_ambassador');
    table.dropColumn('markets_created');
  });
};
