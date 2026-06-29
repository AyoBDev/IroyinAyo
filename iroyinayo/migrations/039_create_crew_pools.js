exports.up = async function (knex) {
  await knex.schema.createTable('crew_pools', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('crew_id').notNullable().references('id').inTable('crews').onDelete('CASCADE');
    table.uuid('creator_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.string('pool_type').notNullable(); // 'public' | 'private'
    table.uuid('parent_market_id').references('id').inTable('multi_markets');
    table.string('title', 200);
    table.string('outcome_a_label', 60);
    table.string('outcome_b_label', 60);
    table.timestamp('kickoff_at').notNullable();
    table.integer('stake_amount').notNullable();
    table.string('currency').notNullable().defaultTo('POINTS');
    table.string('status').notNullable().defaultTo('open');
    table.string('winner_outcome');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('closing_soon_notified_at');
    table.index(['crew_id', 'status']);
    table.index(['parent_market_id']);
    table.index(['status', 'kickoff_at']);
  });

  await knex.raw(`
    ALTER TABLE crew_pools
      ADD CONSTRAINT crew_pools_stake_range CHECK (stake_amount BETWEEN 10 AND 500),
      ADD CONSTRAINT crew_pools_currency_chk CHECK (currency IN ('POINTS', 'NGN')),
      ADD CONSTRAINT crew_pools_type_chk CHECK (pool_type IN ('public', 'private')),
      ADD CONSTRAINT crew_pools_status_chk CHECK (status IN ('open','closed','awaiting_dispute_window','disputed','resolved')),
      ADD CONSTRAINT crew_pools_public_has_market CHECK (
        pool_type <> 'public' OR parent_market_id IS NOT NULL
      ),
      ADD CONSTRAINT crew_pools_private_has_outcomes CHECK (
        pool_type <> 'private' OR (outcome_a_label IS NOT NULL AND outcome_b_label IS NOT NULL)
      )
  `);

  await knex.schema.createTable('crew_pool_predictions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pool_id').notNullable().references('id').inTable('crew_pools').onDelete('CASCADE');
    table.uuid('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.uuid('pending_account_id');
    table.string('predicted_outcome').notNullable();
    table.integer('points_locked').notNullable();
    table.integer('payout').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('pool_id');
  });

  await knex.raw(`
    ALTER TABLE crew_pool_predictions
      ADD CONSTRAINT prediction_actor_xor CHECK (
        (student_id IS NOT NULL AND pending_account_id IS NULL)
        OR (student_id IS NULL AND pending_account_id IS NOT NULL)
      );
    CREATE UNIQUE INDEX prediction_one_per_student ON crew_pool_predictions(pool_id, student_id) WHERE student_id IS NOT NULL;
    CREATE UNIQUE INDEX prediction_one_per_guest ON crew_pool_predictions(pool_id, pending_account_id) WHERE pending_account_id IS NOT NULL;
  `);

  await knex.schema.createTable('crew_pool_resolutions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pool_id').notNullable().unique().references('id').inTable('crew_pools').onDelete('CASCADE');
    table.string('source').notNullable(); // 'api' | 'creator' | 'admin'
    table.uuid('resolver_id').references('id').inTable('students');
    table.uuid('admin_id').references('id').inTable('students');
    table.string('winner_outcome').notNullable();
    table.string('dispute_status').notNullable().defaultTo('none');
    table.timestamp('dispute_window_ends_at');
    table.text('dispute_reason');
    table.text('admin_note');
    table.timestamp('resolved_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE crew_pool_resolutions
      ADD CONSTRAINT resolution_source_chk CHECK (source IN ('api','creator','admin')),
      ADD CONSTRAINT dispute_status_chk CHECK (dispute_status IN ('none','open_window','disputed','resolved'))
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('crew_pool_resolutions');
  await knex.schema.dropTableIfExists('crew_pool_predictions');
  await knex.schema.dropTableIfExists('crew_pools');
};
