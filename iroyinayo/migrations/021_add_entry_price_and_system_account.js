exports.up = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.decimal('entry_price', 10, 6);
  });

  await knex.schema.alterTable('students', (table) => {
    table.boolean('is_system').notNullable().defaultTo(false);
  });

  const existing = await knex('students').where({ phone_number: 'system' }).first();
  if (!existing) {
    await knex('students').insert({
      id: knex.fn.uuid(),
      name: 'IroyinMarket',
      phone_number: 'system',
      is_system: true,
      points_balance: 999999,
      is_onboarded: true,
      is_verified: false,
      is_banned: false,
    });
  }
};

exports.down = async function (knex) {
  await knex('students').where({ phone_number: 'system' }).del();

  await knex.schema.alterTable('students', (table) => {
    table.dropColumn('is_system');
  });

  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.dropColumn('entry_price');
  });
};
