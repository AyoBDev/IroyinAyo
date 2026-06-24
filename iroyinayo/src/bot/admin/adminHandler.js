const adminService = require('../../modules/admin/admin.service');
const marketsService = require('../../modules/markets/markets.service');
const studentsService = require('../../modules/students/students.service');
const contentService = require('../../modules/content/content.service');
const db = require('../../config/database');
const { bold } = require('../formatters');

async function handleAdminCommand(sock, jid, text, msg) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/stats':
      await handleStats(sock, jid);
      break;
    case '/broadcast':
      await handleBroadcast(sock, jid, text.slice('/broadcast'.length).trim(), msg);
      break;
    case '/broadcast-test':
      await handleBroadcastTest(sock, jid, parts[1], text.split(/\s+/).slice(2).join(' '), msg);
      break;
    case '/approve':
      await handleApproveMarket(sock, jid, parts[1]);
      break;
    case '/resolve':
      await handleResolveMarket(sock, jid, parts[1], parts[2]);
      break;
    case '/ban':
      await handleBanStudent(sock, jid, parts[1]);
      break;
    case '/topup':
      await handleTopup(sock, jid, parts[1], parts[2]);
      break;
    default:
      await sock.sendMessage(jid, {
        text: [
          `${bold('Admin Commands:')}`,
          '/stats — Quick engagement summary',
          '/broadcast [message] — Send to all students (attach an image to send image+caption)',
          '/broadcast-test [phone] [message] — Dry-run to one phone (attach image to test image+caption)',
          '/approve [market-id] — Approve a market',
          '/resolve [market-id] [yes/no] — Resolve a market',
          '/ban [phone] — Ban a student',
          '/topup [amount] [market-id] — Sponsor a market',
        ].join('\n'),
      });
  }
}

async function handleStats(sock, jid) {
  const analytics = await adminService.getAnalytics();
  await sock.sendMessage(jid, {
    text: [
      bold('📊 Quick Stats'),
      '',
      `Students: ${analytics.total_students}`,
      `Active today: ${analytics.active_today}`,
      `Points issued: ${analytics.total_points_issued}`,
      `Redemptions: ${analytics.total_redemptions} (${analytics.pending_redemptions} pending)`,
      `Open markets: ${analytics.open_markets}`,
    ].join('\n'),
  });
}

async function extractImageBuffer(msg) {
  if (!msg?.message?.imageMessage) return null;
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    return await downloadMediaMessage(msg, 'buffer', {});
  } catch (err) {
    console.error('Failed to download attached image:', err);
    return null;
  }
}

async function sendBroadcastPayload(sock, recipientJid, message, imageBuffer) {
  if (imageBuffer) {
    await sock.sendMessage(recipientJid, {
      image: imageBuffer,
      caption: message || undefined,
    });
  } else {
    await sock.sendMessage(recipientJid, {
      text: `📢 ${bold('Announcement')}\n\n${message}`,
    });
  }
}

// Randomized 3–8s delay between sends + a 30–60s cool-down every 50 messages.
// WhatsApp flags bursty automation — jitter + chunked pacing keeps the bot under the radar.
const SEND_DELAY_MIN_MS = 3000;
const SEND_DELAY_MAX_MS = 8000;
const CHUNK_SIZE = 50;
const CHUNK_PAUSE_MIN_MS = 30000;
const CHUNK_PAUSE_MAX_MS = 60000;

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleBroadcast(sock, jid, message, msg) {
  const imageBuffer = await extractImageBuffer(msg);

  if (!message && !imageBuffer) {
    await sock.sendMessage(jid, { text: 'Usage: /broadcast [message] — or attach an image with /broadcast as the caption.' });
    return;
  }

  const students = await db('students').where({ is_banned: false }).select('phone_number');
  const kind = imageBuffer ? 'image broadcast' : 'broadcast';

  const estMinSec = Math.round((students.length * SEND_DELAY_MIN_MS + Math.floor(students.length / CHUNK_SIZE) * CHUNK_PAUSE_MIN_MS) / 1000);
  const estMaxSec = Math.round((students.length * SEND_DELAY_MAX_MS + Math.floor(students.length / CHUNK_SIZE) * CHUNK_PAUSE_MAX_MS) / 1000);
  await sock.sendMessage(jid, {
    text: `⏳ Starting ${kind} to ${students.length} students. Estimated time: ${Math.round(estMinSec / 60)}–${Math.round(estMaxSec / 60)} min. I'll report when done.`,
  });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      await sendBroadcastPayload(sock, `${student.phone_number}@s.whatsapp.net`, message, imageBuffer);
      sent++;
    } catch (err) {
      failed++;
    }

    if (i < students.length - 1) {
      const isChunkBoundary = (i + 1) % CHUNK_SIZE === 0;
      if (isChunkBoundary) {
        await randomDelay(CHUNK_PAUSE_MIN_MS, CHUNK_PAUSE_MAX_MS);
      } else {
        await randomDelay(SEND_DELAY_MIN_MS, SEND_DELAY_MAX_MS);
      }
    }
  }

  await sock.sendMessage(jid, { text: `✅ ${kind} sent to ${sent}/${students.length} students${failed ? ` (${failed} failed)` : ''}.` });
}

async function handleBroadcastTest(sock, jid, phone, message, msg) {
  if (!phone) {
    await sock.sendMessage(jid, { text: 'Usage: /broadcast-test [phone] [message] — attach an image to test image+caption.' });
    return;
  }

  const cleanPhone = phone.replace(/[^\d]/g, '');
  if (!cleanPhone) {
    await sock.sendMessage(jid, { text: 'Invalid phone number.' });
    return;
  }

  const imageBuffer = await extractImageBuffer(msg);

  if (!message && !imageBuffer) {
    await sock.sendMessage(jid, { text: 'Provide a message or attach an image.' });
    return;
  }

  try {
    await sendBroadcastPayload(sock, `${cleanPhone}@s.whatsapp.net`, message, imageBuffer);
    await sock.sendMessage(jid, { text: `✅ Test broadcast sent to ${cleanPhone}. Review it before running /broadcast.` });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Test send failed: ${err.message}` });
  }
}

async function handleApproveMarket(sock, jid, marketIdPrefix) {
  if (!marketIdPrefix) {
    await sock.sendMessage(jid, { text: 'Usage: /approve [market-id]' });
    return;
  }

  const pending = await marketsService.listPendingApproval();
  const market = pending.find((m) => m.id.startsWith(marketIdPrefix));

  if (!market) {
    await sock.sendMessage(jid, { text: 'Market not found in pending list.' });
    return;
  }

  const approved = await marketsService.approve(market.id);
  await sock.sendMessage(jid, { text: `✅ Market approved: ${bold(approved.question)}` });
}

async function handleResolveMarket(sock, jid, marketIdPrefix, outcome) {
  if (!marketIdPrefix || !outcome) {
    await sock.sendMessage(jid, { text: 'Usage: /resolve [market-id] [yes/no]' });
    return;
  }

  const markets = await db('markets').where('status', '!=', 'resolved');
  const market = markets.find((m) => m.id.startsWith(marketIdPrefix));

  if (!market) {
    await sock.sendMessage(jid, { text: 'Market not found.' });
    return;
  }

  try {
    const resolved = await marketsService.resolve(market.id, outcome.toLowerCase());
    await sock.sendMessage(jid, {
      text: `✅ Market resolved: ${bold(resolved.question)}\nOutcome: ${bold(outcome.toUpperCase())}`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleBanStudent(sock, jid, phone) {
  if (!phone) {
    await sock.sendMessage(jid, { text: 'Usage: /ban [phone]' });
    return;
  }

  const student = await studentsService.getByPhone(phone);
  if (!student) {
    await sock.sendMessage(jid, { text: 'Student not found.' });
    return;
  }

  await adminService.banStudent(student.id);
  await sock.sendMessage(jid, { text: `✅ Student ${bold(student.name)} (${phone}) has been banned.` });
}

async function handleTopup(sock, jid, amountStr, marketIdPrefix) {
  if (!amountStr || !marketIdPrefix) {
    await sock.sendMessage(jid, { text: 'Usage: /topup [amount] [market-id]' });
    return;
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    await sock.sendMessage(jid, { text: 'Amount must be a positive number.' });
    return;
  }

  const markets = await db('markets').where({ status: 'open' });
  const market = markets.find((m) => m.id.startsWith(marketIdPrefix));

  if (!market) {
    await sock.sendMessage(jid, { text: 'Market not found.' });
    return;
  }

  const sponsored = await marketsService.sponsorMarket(market.id, amount);
  await sock.sendMessage(jid, {
    text: `✅ Added ${bold(`${amount} pts`)} bonus to: ${bold(sponsored.question)}\nTotal bonus: ${sponsored.sponsor_bonus} pts`,
  });
}

module.exports = { handleAdminCommand };
