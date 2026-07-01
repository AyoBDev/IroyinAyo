const db = require('../../config/database');

const FD_BASE = 'https://api.football-data.org/v4';

// NOTE: circle_pools no longer reference fixtures (migration 042 re-pointed the
// FK to multi_markets). The Football-Data fixture cache here is preserved for
// future use (e.g. a dedicated football-events feed) but is no longer wired
// into the circle pool auto-resolution path. resolvePoolsForFixture has been
// removed; resolveMarket() in multiMarkets.service cascades to circle pools
// directly.

function err(code, message, userMessage, status = 400) {
  const e = new Error(message);
  e.code = code; e.userMessage = userMessage; e.status = status;
  return e;
}

function computeWinner(homeScore, awayScore) {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

async function fdFetch(path) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw err('CONFIG', 'No token', 'Server config error.', 500);
  const res = await fetch(`${FD_BASE}${path}`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw err('FD_API_ERROR', `Football-Data error ${res.status}: ${text}`, 'Unable to fetch fixtures.', 502);
  }
  return res.json();
}

async function pollUpcomingFixtures() {
  // World Cup (WC) + Premier League (PL); extend as needed
  const competitions = ['WC', 'PL'];
  const dateFrom = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let ingested = 0;
  for (const comp of competitions) {
    let data;
    try {
      data = await fdFetch(`/competitions/${comp}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    } catch (e) {
      console.error(`[fixtures] poll ${comp} failed:`, e.message);
      continue;
    }
    for (const m of (data.matches || [])) {
      const externalId = String(m.id);
      const existing = await db('fixtures').where({ external_id: externalId }).first();
      const payload = {
        external_id: externalId,
        source: 'football-data',
        competition: comp,
        home_team: m.homeTeam?.shortName || m.homeTeam?.name || '?',
        away_team: m.awayTeam?.shortName || m.awayTeam?.name || '?',
        kickoff_at: new Date(m.utcDate),
        status: mapStatus(m.status),
        updated_at: db.fn.now(),
      };
      if (existing) {
        await db('fixtures').where({ id: existing.id }).update(payload);
      } else {
        await db('fixtures').insert(payload);
        ingested++;
      }
    }
  }
  return { ingested };
}

function mapStatus(s) {
  // FD: SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED, CANCELLED, SUSPENDED, AWARDED
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'live';
  if (s === 'POSTPONED') return 'postponed';
  if (s === 'CANCELLED' || s === 'SUSPENDED') return 'cancelled';
  return 'scheduled';
}

async function pollCompletedFixtures() {
  const competitions = ['WC', 'PL'];
  const dateFrom = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dateTo = new Date().toISOString().slice(0, 10);
  let resolved = 0;
  for (const comp of competitions) {
    let data;
    try {
      data = await fdFetch(`/competitions/${comp}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`);
    } catch (e) {
      console.error(`[fixtures] completed poll ${comp} failed:`, e.message);
      continue;
    }
    for (const m of (data.matches || [])) {
      const externalId = String(m.id);
      const fixture = await db('fixtures').where({ external_id: externalId }).first();
      if (!fixture) continue;
      if (fixture.status === 'finished' && fixture.winner) continue; // already done
      const homeScore = m.score?.fullTime?.home ?? null;
      const awayScore = m.score?.fullTime?.away ?? null;
      const winner = computeWinner(homeScore, awayScore);
      if (winner == null) continue; // missing data; skip
      await db('fixtures').where({ id: fixture.id }).update({
        home_score: homeScore, away_score: awayScore, winner,
        status: 'finished', updated_at: db.fn.now(),
      });
      resolved++;
    }
  }
  // poolsResolved removed: circle pools no longer attach to fixtures. They
  // resolve via the multi_markets cascade in markets/multiMarkets.service.js.
  return { resolved };
}

async function manualSubmitResult(fixtureId, { home_score, away_score }) {
  const fixture = await db('fixtures').where({ id: fixtureId }).first();
  if (!fixture) throw err('FIXTURE_NOT_FOUND', 'No fixture', 'Fixture not found.', 404);
  const winner = computeWinner(home_score, away_score);
  if (winner == null) throw err('VALIDATION', 'Need scores', 'Both scores required.');
  await db('fixtures').where({ id: fixtureId }).update({
    home_score, away_score, winner, status: 'finished', updated_at: db.fn.now(),
  });
  // No circle pool cascade here — pools wrap multi_markets, not fixtures.
  return { winner };
}

async function getFixturesForDateRange(from, to) {
  // Return only upcoming, predictable fixtures so the picker can't show
  // finished/postponed/cancelled matches (which would fail createPool checks).
  return db('fixtures')
    .where('kickoff_at', '>=', from)
    .where('kickoff_at', '<=', to)
    .where('status', 'scheduled')
    .orderBy('kickoff_at', 'asc');
}

module.exports = {
  pollUpcomingFixtures,
  pollCompletedFixtures,
  manualSubmitResult,
  getFixturesForDateRange,
  computeWinner,
};
