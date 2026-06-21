exports.up = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.string('source_ref', 64).nullable();
    table.index('source_ref', 'idx_positions_source_ref');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.dropIndex('source_ref', 'idx_positions_source_ref');
    table.dropColumn('source_ref');
  });
};
