exports.up = function (knex) {
  return knex.schema
    .createTable('content', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('title').notNullable();
      table.text('body').notNullable();
      table.string('source').defaultTo('manual');
      table.string('source_url');
      table.boolean('is_broadcast').notNullable().defaultTo(false);
      table.boolean('is_approved').notNullable().defaultTo(true);
      table.boolean('is_published').notNullable().defaultTo(false);
      table.timestamp('scheduled_at');
      table.timestamp('published_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('content_tags', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('content_id').notNullable().references('id').inTable('content').onDelete('CASCADE');
      table.string('category').notNullable();
      table.unique(['content_id', 'category']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('content_tags')
    .dropTableIfExists('content');
};
