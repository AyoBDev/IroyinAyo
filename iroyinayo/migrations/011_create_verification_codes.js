exports.up = function (knex) {
  return knex.schema.createTable('verification_codes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('phone_number').notNullable();
    table.string('code', 6).notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['phone_number', 'code']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('verification_codes');
};
