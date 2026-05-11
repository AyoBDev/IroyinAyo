const multiMarkets = require('../../modules/markets/multiMarkets.service');
const gamificationService = require('../../modules/gamification/gamification.service');
const db = require('../../config/database');
const { bold } = require('../formatters');

async function handleHackathonAdmin(sock, jid, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/addteam':
      await handleAddTeam(sock, jid, parts);
      break;
    case '/removeteam':
      await handleRemoveTeam(sock, jid, parts);
      break;
    case '/resolve':
      await handleResolve(sock, jid, parts);
      break;
    case '/markets':
      await handleListMarkets(sock, jid);
      break;
    case '/addpoints':
      await handleAddPoints(sock, jid, parts);
      break;
    case '/setup':
      await handleSetup(sock, jid);
      break;
    default:
      await sock.sendMessage(jid, {
        text: [
          bold('Admin Commands:'),
          '/setup — Create the 3 default markets (1st, 2nd, 3rd)',
          '/addteam [market#] [Team Name] — Add team to a market',
          '/removeteam [market#] [team#] — Remove team (no bets)',
          '/resolve [market#] [team#] — Resolve market',
          '/markets — List all markets',
          '/addpoints [phone] [amount] — Give points',
        ].join('\n'),
      });
  }
}

async function handleSetup(sock, jid) {
  const existing = await db('multi_markets').count('id as count').first();
  if (parseInt(existing.count, 10) > 0) {
    await sock.sendMessage(jid, { text: 'Markets already exist. Use /markets to view them.' });
    return;
  }

  await multiMarkets.createMarket('Who will win 1st place?');
  await multiMarkets.createMarket('Who will win 2nd place?');
  await multiMarkets.createMarket('Who will win 3rd place?');

  await sock.sendMessage(jid, {
    text: `✅ Created 3 markets (1st, 2nd, 3rd place).\nNow use ${bold('/addteam [market#] [Team Name]')} to add teams.`,
  });
}

async function handleAddTeam(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /addteam [market#] [Team Name]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamName = parts.slice(2).join(' ');

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number. You have ${markets.length} markets.` });
    return;
  }

  const market = markets[marketNum - 1];

  try {
    await multiMarkets.addOutcome(market.id, teamName);
    const updated = await multiMarkets.getMarketWithOdds(market.id);
    await sock.sendMessage(jid, {
      text: `✅ Added ${bold(teamName)} to ${bold(market.title)}\nNow has ${updated.outcomes.length} teams.`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleRemoveTeam(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /removeteam [market#] [team#]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamNum = parseInt(parts[2], 10);

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number.` });
    return;
  }

  const market = markets[marketNum - 1];
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: market.id })
    .orderBy('created_at', 'asc');

  if (isNaN(teamNum) || teamNum < 1 || teamNum > outcomes.length) {
    await sock.sendMessage(jid, { text: `Invalid team number.` });
    return;
  }

  try {
    await multiMarkets.removeOutcome(market.id, outcomes[teamNum - 1].id);
    await sock.sendMessage(jid, { text: `✅ Removed ${bold(outcomes[teamNum - 1].label)} from ${bold(market.title)}` });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleResolve(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /resolve [market#] [team#]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamNum = parseInt(parts[2], 10);

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number.` });
    return;
  }

  const market = markets[marketNum - 1];
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: market.id })
    .orderBy('created_at', 'asc');

  if (isNaN(teamNum) || teamNum < 1 || teamNum > outcomes.length) {
    await sock.sendMessage(jid, { text: `Invalid team number.` });
    return;
  }

  try {
    await multiMarkets.resolveMarket(market.id, outcomes[teamNum - 1].id);
    await sock.sendMessage(jid, {
      text: `✅ ${bold(market.title)} resolved!\nWinner: ${bold(outcomes[teamNum - 1].label)}`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleListMarkets(sock, jid) {
  const markets = await multiMarkets.listOpenMarkets();
  const all = await db('multi_markets').orderBy('created_at', 'asc');

  const lines = all.map((m, i) => {
    const marketWithOdds = markets.find((om) => om.id === m.id);
    const teamCount = marketWithOdds ? marketWithOdds.outcomes.length : 0;
    const statusEmoji = m.status === 'resolved' ? '✅' : '🟢';
    return `${i + 1}. ${statusEmoji} ${m.title} (${teamCount} teams) [${m.status}]`;
  });

  await sock.sendMessage(jid, {
    text: [bold('📊 All Markets'), '', ...lines].join('\n'),
  });
}

async function handleAddPoints(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /addpoints [phone] [amount]' });
    return;
  }

  const phone = parts[1];
  const amount = parseInt(parts[2], 10);
  if (isNaN(amount) || amount <= 0) {
    await sock.sendMessage(jid, { text: 'Amount must be a positive number.' });
    return;
  }

  const student = await db('students').where({ phone_number: phone }).first();
  if (!student) {
    await sock.sendMessage(jid, { text: 'Student not found.' });
    return;
  }

  await gamificationService.addPoints(student.id, amount, 'admin_grant', 'Admin top-up');
  await sock.sendMessage(jid, { text: `✅ Added ${amount} pts to ${bold(student.name)} (${phone})` });
}

module.exports = { handleHackathonAdmin };
