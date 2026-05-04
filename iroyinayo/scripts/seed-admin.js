#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/database');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=x ADMIN_PASSWORD=x [ADMIN_NAME=x] node scripts/seed-admin.js');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    const existing = await db('admins').where({ email }).first();
    if (existing) {
      console.error(`Admin with email ${email} already exists`);
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [admin] = await db('admins')
      .insert({ email, password_hash, name, role: 'super_admin' })
      .returning(['id', 'email', 'name', 'role']);

    console.log('Admin created successfully:', admin);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

seedAdmin();
