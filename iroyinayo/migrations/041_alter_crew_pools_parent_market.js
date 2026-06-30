/**
 * Re-points crew_pools.parent_market_id from multi_markets → fixtures.
 *
 * The original spec attached public pools to multi_markets, but the public-event
 * pipeline (Football-Data ingest, auto-resolution by computed winner) is built
 * entirely around the `fixtures` table. Re-FK'ing here makes the data model
 * match the runtime: the picker returns fixtures.id and the auto-resolver
 * queries by fixtures.id.
 *
 * SAFETY: clears any existing values first so the FK switch can't be blocked by
 * orphan rows. Crews are pre-launch, so no production data is at risk.
 */
exports.up = async function (knex) {
  // Null out any existing parent_market_id values — they pointed at
  // multi_markets and would orphan against fixtures. Crews has no live data.
  await knex('crew_pools').whereNotNull('parent_market_id').update({ parent_market_id: null });

  await knex.schema.alterTable('crew_pools', (table) => {
    table.dropForeign('parent_market_id');
  });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.foreign('parent_market_id').references('id').inTable('fixtures');
  });
};

exports.down = async function (knex) {
  await knex('crew_pools').whereNotNull('parent_market_id').update({ parent_market_id: null });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.dropForeign('parent_market_id');
  });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.foreign('parent_market_id').references('id').inTable('multi_markets');
  });
};
