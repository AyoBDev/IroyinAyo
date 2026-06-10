exports.up = async function (knex) {
  await knex.schema.createTable('market_liquidity_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('market_id').nullable().references('id').inTable('markets');
    table.uuid('multi_market_id').nullable().references('id').inTable('multi_markets');
    table.text('source_type').notNullable().defaultTo('admin');
    table.jsonb('target_probabilities').notNullable();
    table.text('odds_api_event_id').nullable();
    table.text('odds_api_market_key').nullable();
    table.decimal('drift_threshold', 5, 4).notNullable().defaultTo(0.10);
    table.decimal('correction_strength', 5, 4).notNullable().defaultTo(0.50);
    table.integer('max_correction_amount').notNullable().defaultTo(200);
    table.integer('cooldown_seconds').notNullable().defaultTo(30);
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('last_correction_at').nullable();
    table.timestamps(true, true);

    table.unique('market_id');
    table.unique('multi_market_id');
  });

  await knex.raw(`
    ALTER TABLE market_liquidity_config
    ADD CONSTRAINT chk_one_market_type
    CHECK (
      (market_id IS NOT NULL AND multi_market_id IS NULL) OR
      (market_id IS NULL AND multi_market_id IS NOT NULL)
    )
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('market_liquidity_config');
};
