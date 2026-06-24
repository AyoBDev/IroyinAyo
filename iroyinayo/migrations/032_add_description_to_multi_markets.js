exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('multi_markets', 'description');
  if (hasColumn) return;
  await knex.schema.alterTable('multi_markets', (table) => {
    table.text('description').nullable();
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('multi_markets', 'description');
  if (!hasColumn) return;
  await knex.schema.alterTable('multi_markets', (table) => {
    table.dropColumn('description');
  });
};
