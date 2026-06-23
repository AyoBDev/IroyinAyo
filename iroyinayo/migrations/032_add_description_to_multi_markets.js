exports.up = async function (knex) {
  await knex.schema.alterTable('multi_markets', (table) => {
    table.text('description').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('multi_markets', (table) => {
    table.dropColumn('description');
  });
};
