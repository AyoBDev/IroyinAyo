exports.up = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.string('whatsapp_jid');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('students', (table) => {
    table.dropColumn('whatsapp_jid');
  });
};
