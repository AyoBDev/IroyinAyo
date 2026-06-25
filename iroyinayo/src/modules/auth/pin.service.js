const bcrypt = require('bcrypt');
const db = require('../../config/database');
const { ValidationError } = require('../../utils/errors');

const PIN_REGEX = /^\d{6}$/;
const MAX_ATTEMPTS = 3;
const BCRYPT_COST = 10;

function validatePinFormat(pin) {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

async function setPin({ authUserId, pin }) {
  if (!validatePinFormat(pin)) {
    throw new ValidationError('pin must be 6 digits');
  }
  const hash = await bcrypt.hash(pin, BCRYPT_COST);
  await db('students')
    .where({ auth_user_id: authUserId })
    .update({ pin_hash: hash, pin_failed_attempts: 0 });
}

async function verifyPin({ authUserId, pin }) {
  const student = await db('students').where({ auth_user_id: authUserId }).first();

  if (!student || !student.pin_hash) {
    return { ok: false, code: 'NO_PIN' };
  }

  if (student.pin_failed_attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: 'PIN_LOCKED' };
  }

  const malformed = !validatePinFormat(pin);
  const matches = malformed ? false : await bcrypt.compare(pin, student.pin_hash);

  if (matches) {
    await db('students').where({ auth_user_id: authUserId }).update({ pin_failed_attempts: 0 });
    return { ok: true };
  }

  await db('students').where({ auth_user_id: authUserId }).increment('pin_failed_attempts', 1);
  const newCount = student.pin_failed_attempts + 1;
  if (newCount >= MAX_ATTEMPTS) {
    return { ok: false, code: 'PIN_LOCKED' };
  }
  return { ok: false, code: 'PIN_INVALID', attemptsRemaining: MAX_ATTEMPTS - newCount };
}

module.exports = { setPin, verifyPin };
