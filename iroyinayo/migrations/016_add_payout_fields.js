exports.up = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.string('payout_recipient_code');
    table.string('payout_account_name');
    table.string('payout_bank_code');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.dropColumn('payout_recipient_code');
    table.dropColumn('payout_account_name');
    table.dropColumn('payout_bank_code');
  });
};
