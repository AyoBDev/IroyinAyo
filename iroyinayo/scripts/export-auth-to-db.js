#!/usr/bin/env node
/**
 * Export local Baileys auth_store/ files to PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/export-auth-to-db.js
 *
 * Or if you have a .env with DATABASE_URL:
 *   node scripts/export-auth-to-db.js
 *
 * This reads all JSON files from ./auth_store/ and upserts them
 * into the baileys_auth table so Railway can use them.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const knex = require('knex');

const AUTH_DIR = path.join(__dirname, '..', 'auth_store');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required. Set it in .env or pass it directly:');
    console.error('  DATABASE_URL=postgres://... node scripts/export-auth-to-db.js');
    process.exit(1);
  }

  if (!fs.existsSync(AUTH_DIR)) {
    console.error(`auth_store/ directory not found at ${AUTH_DIR}`);
    console.error('Run the bot locally first to generate auth files (scan QR code).');
    process.exit(1);
  }

  const isRemote = dbUrl.includes('railway') || dbUrl.includes('amazonaws') || dbUrl.includes('neon');
  const db = knex({
    client: 'pg',
    connection: isRemote
      ? { connectionString: dbUrl, ssl: { rejectUnauthorized: false } }
      : dbUrl,
  });

  try {
    // Ensure the table exists
    const hasTable = await db.schema.hasTable('baileys_auth');
    if (!hasTable) {
      console.log('Creating baileys_auth table...');
      await db.schema.createTable('baileys_auth', (table) => {
        table.string('key').primary();
        table.jsonb('value').notNullable();
        table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      });
    }

    const files = fs.readdirSync(AUTH_DIR).filter((f) => f.endsWith('.json'));

    if (files.length === 0) {
      console.error('No .json files found in auth_store/. Is the bot paired?');
      process.exit(1);
    }

    let count = 0;
    for (const file of files) {
      const filePath = path.join(AUTH_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const key = path.basename(file, '.json');

      // Use raw SQL to insert the JSON string directly — avoids
      // double-serialization issues with Buffer objects in Baileys auth data
      await db.raw(
        `INSERT INTO baileys_auth (key, value, updated_at)
         VALUES (?, ?::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, raw]
      );

      count++;
    }

    console.log(`Exported ${count} auth files to database.`);
    console.log('Your Railway deployment will now pick up the WhatsApp session.');
  } catch (err) {
    console.error('Export failed:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
