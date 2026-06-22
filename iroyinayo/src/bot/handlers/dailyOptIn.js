const db = require('../../config/database');

const PAUSE_DAYS = 7;

async function handleDailyOptIn({ phoneNumber, text, sock }) {
  const student = await db('students').where({ phone_number: phoneNumber }).first();
  if (!student) return { handled: false };

  const cmd = (text || '').trim().toUpperCase();
  const jid = `${phoneNumber}@s.whatsapp.net`;

  if (cmd.startsWith('PAUSE')) {
    const until = new Date(Date.now() + PAUSE_DAYS * 24 * 60 * 60 * 1000);
    await db('students').where({ id: student.id }).update({ wa_paused_until: until });
    if (sock) await sock.sendMessage(jid, { text: `Paused for ${PAUSE_DAYS} days. We'll be back.` });
    return { handled: true };
  }
  if (cmd.startsWith('STOP')) {
    await db('students').where({ id: student.id }).update({ wa_daily_enabled: false, wa_paused_until: null });
    if (sock) await sock.sendMessage(jid, { text: `Stopped. Re-enable from the web app whenever you're ready.` });
    return { handled: true };
  }

  if (!student.wa_daily_enabled && student.is_onboarded) {
    await db('students').where({ id: student.id }).update({ wa_daily_enabled: true });
  }
  return { handled: false };
}

module.exports = { handleDailyOptIn };
