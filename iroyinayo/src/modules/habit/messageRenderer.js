const crypto = require('crypto');

const GREETINGS = ['Good morning', 'Morning', 'Hey', 'Good morning oh'];

function pickGreeting(studentId, dayKey) {
  const h = crypto.createHash('md5').update(`${studentId}:${dayKey}`).digest();
  return GREETINGS[h[0] % GREETINGS.length];
}

function formatRelativeTime(minutes) {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

function renderLede(type, payload) {
  switch (type) {
    case 'rank': {
      const dir = payload.rankDelta > 0 ? 'up' : 'down';
      return `You're rank #${payload.currentRank} — ${dir} ${Math.abs(payload.rankDelta)} since yesterday.`;
    }
    case 'resolution':
      return `${payload.count} of your calls resolve today.`;
    case 'social':
      return `${payload.friendName} just called ${payload.marketTitle}.`;
    case 'curiosity':
      return payload.marketTitle.endsWith('?') ? payload.marketTitle : `${payload.marketTitle}.`;
    default:
      return '';
  }
}

function renderMarketsLine(markets) {
  return markets
    .slice(0, 3)
    .map((m) => `${m.label} · ${formatRelativeTime(m.resolves_in_minutes)}`)
    .join(', ');
}

function renderCta(appUrl, ledeType, queueRow) {
  const marketSegment = queueRow.lede_payload?.marketId ? `/market/${queueRow.lede_payload.marketId}` : '';
  return `Open IroyinMarket → ${appUrl}${marketSegment}?ref=wa_daily&lede=${ledeType}`;
}

function dayKeyFor(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function renderMessage({ student, queueRow, appUrl }) {
  const greeting = pickGreeting(student.id, dayKeyFor(queueRow.scheduled_for));
  const lede = renderLede(queueRow.lede_type, queueRow.lede_payload);
  const marketsLine = renderMarketsLine(queueRow.markets);
  const cta = renderCta(appUrl, queueRow.lede_type, queueRow);
  const body = [
    `${greeting}, ${student.name}.`,
    '',
    lede,
    marketsLine,
    cta,
    '',
    'Reply PAUSE to pause for 7 days.',
  ].filter((line) => line !== null).join('\n');
  return body;
}

module.exports = { renderMessage, pickGreeting };
