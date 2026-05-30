exports.up = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.boolean('win_acknowledged').defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.dropColumn('win_acknowledged');
  });
};
