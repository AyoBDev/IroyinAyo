exports.up = function (knex) {
  return knex.schema.createTable('baileys_auth', (table) => {
    table.string('key').primary();
    table.jsonb('value').notNullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('baileys_auth');
};
