exports.up = async function (knex) {
  await knex.schema.alterTable('crew_pool_resolutions', (table) => {
    table.jsonb('confirmations').notNullable().defaultTo('[]');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('crew_pool_resolutions', (table) => {
    table.dropColumn('confirmations');
  });
};
