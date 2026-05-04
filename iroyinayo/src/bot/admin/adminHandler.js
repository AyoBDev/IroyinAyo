const adminService = require('../../modules/admin/admin.service');
const marketsService = require('../../modules/markets/markets.service');
const studentsService = require('../../modules/students/students.service');
const contentService = require('../../modules/content/content.service');
const db = require('../../config/database');
const { bold } = require('../formatters');

async function handleAdminCommand(sock, jid, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/stats':
      await handleStats(sock, jid);
      break;
    case '/broadcast':
      await handleBroadcast(sock, jid, text.slice('/broadcast'.length).trim());
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
          '/broadcast [message] — Send to all students',
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

async function handleBroadcast(sock, jid, message) {
  if (!message) {
    await sock.sendMessage(jid, { text: 'Usage: /broadcast [message]' });
    return;
  }

  const students = await db('students').where({ is_banned: false }).select('phone_number');
  let sent = 0;

  for (const student of students) {
    try {
      await sock.sendMessage(`${student.phone_number}@s.whatsapp.net`, {
        text: `📢 ${bold('Announcement')}\n\n${message}`,
      });
      sent++;
    } catch (err) {
      // Skip failed sends
    }
  }

  await sock.sendMessage(jid, { text: `✅ Broadcast sent to ${sent}/${students.length} students.` });
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
