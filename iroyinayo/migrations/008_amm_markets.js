exports.up = function (knex) {
  return knex.schema
    .alterTable('markets', (table) => {
      table.integer('liquidity').notNullable().defaultTo(100);
    })
    .alterTable('market_positions', (table) => {
      table.float('shares').notNullable().defaultTo(0);
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('market_positions', (table) => {
      table.dropColumn('shares');
    })
    .alterTable('markets', (table) => {
      table.dropColumn('liquidity');
    });
};
