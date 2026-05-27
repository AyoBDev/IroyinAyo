exports.up = async function (knex) {
  const hasCategory = await knex.schema.hasColumn('multi_markets', 'category');

  await knex.schema.alterTable('multi_markets', (table) => {
    table.boolean('is_sponsored').defaultTo(false);
    table.boolean('is_featured').defaultTo(false);
    table.string('sponsor_name').nullable();
    table.string('sponsor_logo_url').nullable();
    if (!hasCategory) {
      table.string('category').nullable();
    }
  });
};

exports.down = async function (knex) {
  const hasCategory = await knex.schema.hasColumn('multi_markets', 'category');

  await knex.schema.alterTable('multi_markets', (table) => {
    table.dropColumn('is_sponsored');
    table.dropColumn('is_featured');
    table.dropColumn('sponsor_name');
    table.dropColumn('sponsor_logo_url');
    if (hasCategory) {
      table.dropColumn('category');
    }
  });
};
