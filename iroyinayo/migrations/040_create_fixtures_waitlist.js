exports.up = async function (knex) {
  await knex.schema.createTable('fixtures', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('external_id').notNullable().unique();
    table.string('source').notNullable().defaultTo('football-data');
    table.string('competition'); // e.g. 'WC', 'PL'
    table.string('home_team').notNullable();
    table.string('away_team').notNullable();
    table.timestamp('kickoff_at').notNullable();
    table.string('status').notNullable().defaultTo('scheduled');
    table.integer('home_score');
    table.integer('away_score');
    table.string('winner'); // 'home' | 'away' | 'draw'
    table.timestamp('ingested_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['status', 'kickoff_at']);
  });

  await knex.raw(`
    ALTER TABLE fixtures
      ADD CONSTRAINT fixture_status_chk CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
      ADD CONSTRAINT fixture_winner_chk CHECK (winner IS NULL OR winner IN ('home','away','draw'))
  `);

  await knex.schema.createTable('realmoney_waitlist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().unique().references('id').inTable('students').onDelete('CASCADE');
    table.string('source_context');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('realmoney_waitlist');
  await knex.schema.dropTableIfExists('fixtures');
};
