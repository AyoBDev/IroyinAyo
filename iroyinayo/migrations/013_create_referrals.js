exports.up = function (knex) {
  return knex.schema
    .alterTable('students', (table) => {
      table.string('referral_code').unique();
      table.uuid('referred_by').references('id').inTable('students').onDelete('SET NULL');
    })
    .createTable('referrals', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('referrer_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('referred_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.integer('referrer_bonus').notNullable().defaultTo(50);
      table.integer('referred_bonus').notNullable().defaultTo(50);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.unique(['referred_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('referrals')
    .alterTable('students', (table) => {
      table.dropColumn('referral_code');
      table.dropColumn('referred_by');
    });
};
