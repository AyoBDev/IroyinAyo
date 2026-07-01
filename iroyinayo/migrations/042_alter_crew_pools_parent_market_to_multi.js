/**
 * Re-points crew_pools.parent_market_id from fixtures → multi_markets.
 *
 * Original spec attached public pools to multi_markets. Migration 041 redirected
 * the FK to fixtures because the public-event pipeline was wired around
 * Football-Data fixtures. We're now consolidating: public crew pools wrap rows
 * in the existing Markets feed (multi_markets), so the picker and Markets feed
 * show the same source of truth and auto-resolution rides the existing
 * resolveMarket() path.
 *
 * SAFETY: clears any existing values first so the FK switch can't be blocked by
 * orphan rows. Crews are pre-launch, so no production data is at risk.
 */
exports.up = async function (knex) {
  // Null out any existing parent_market_id values — they pointed at
  // fixtures and would orphan against multi_markets. Crews has no live data.
  await knex('crew_pools').whereNotNull('parent_market_id').update({ parent_market_id: null });

  await knex.schema.alterTable('crew_pools', (table) => {
    table.dropForeign('parent_market_id');
  });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.foreign('parent_market_id').references('id').inTable('multi_markets');
  });
};

exports.down = async function (knex) {
  await knex('crew_pools').whereNotNull('parent_market_id').update({ parent_market_id: null });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.dropForeign('parent_market_id');
  });
  await knex.schema.alterTable('crew_pools', (table) => {
    table.foreign('parent_market_id').references('id').inTable('fixtures');
  });
};
