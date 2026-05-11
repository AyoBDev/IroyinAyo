# Hackathon Prediction Market Bot

## Overview

A WhatsApp bot that lets hackathon spectators predict which teams will win 1st, 2nd, and 3rd place using play money. Multi-outcome LMSR market maker ensures prices always sum to 100%. Leaderboard for bragging rights.

**Branch:** `hackathon-predictions` (off `main`)
**Platform:** WhatsApp (Baileys)
**Users:** Hackathon spectators
**Engagement model:** Free 100 points on first message, bet on teams, compete on leaderboard

---

## Architecture

### What stays from Iroyinayo main branch

- WhatsApp connection (Baileys + auth state in DB)
- Database config (Postgres via Knex)
- Express app (admin API)
- Gamification service (points + leaderboard only)
- Students table (phone, name, points)

### What gets removed/disabled

- Quiz, rewards, redeem, interests, info, content modules
- Full onboarding flow (replaced with auto-registration)
- Daily scheduled jobs / cron
- Binary market system (dormant, untouched)

### What's new

- Multi-outcome LMSR market maker
- Simplified message handler (prediction-only flow)
- Admin commands for team management and resolution
- New migration for multi-outcome tables

---

## Multi-Outcome LMSR Math

### Cost function (N outcomes)

```
C(q1, q2, ..., qN) = b * ln(e^(q1/b) + e^(q2/b) + ... + e^(qN/b))
```

Where `qi` = total shares sold for outcome i, `b` = liquidity parameter.

### Price of outcome i

```
price_i = e^(qi/b) / sum(e^(qj/b) for all j)
```

This is the softmax function. All prices sum to 1 (100 cents) always.

### Cost to buy n shares of outcome i

```
cost = C(q1, ..., qi + n, ..., qN) - C(q1, ..., qi, ..., qN)
```

Given a spend amount, binary search for n where cost = amount.

### Resolution

- Each winning share pays exactly 1 point
- Losing shares pay 0 points
- No fee (keep it simple for a hackathon)

### Liquidity parameter

`b = 100`. With 100-point balances and ~10 teams, prices move noticeably but not wildly on single bets.

---

## Database Schema

New migration (on `hackathon-predictions` branch only):

### multi_markets

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| title | string | e.g., "Who will win 1st place?" |
| status | string | 'open' or 'resolved' |
| liquidity_b | integer | LMSR b parameter, default 100 |
| winning_outcome_id | uuid (nullable) | FK to multi_market_outcomes |
| created_at | timestamp | |
| resolved_at | timestamp (nullable) | |

### multi_market_outcomes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| market_id | uuid (FK) | references multi_markets |
| label | string | team name |
| shares_sold | float | qi value for LMSR, default 0 |
| created_at | timestamp | |

### multi_market_positions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| market_id | uuid (FK) | references multi_markets |
| outcome_id | uuid (FK) | references multi_market_outcomes |
| student_id | uuid (FK) | references students |
| amount | integer | points spent |
| shares | float | shares received |
| payout | integer | default 0 |
| created_at | timestamp | |

---

## User Flow

### First message (any text)

Bot checks if phone exists in students table:
- **Not found:** Auto-register (phone as name, 100 points), then show markets
- **Found:** Show markets directly

### Market list

```
🏆 Hackathon Prediction Markets

1️⃣ Who wins 1st place?
2️⃣ Who wins 2nd place?
3️⃣ Who wins 3rd place?

Reply with a number to see odds and bet.
Type "leaderboard" for rankings.
Type "my bets" to see your positions.
Type "balance" to check your points.
```

### View market (reply with number)

```
📊 1st Place — Current Odds:

1. Team Alpha — 20¢
2. Team Beta — 15¢
3. Team Gamma — 12¢
...

Reply: bet [team#] [amount]
Example: bet 1 30

Type "back" to return to markets.
```

### Place bet

```
✅ Bet placed!
Team Alpha to win 1st place
Spent: 30 pts | Shares: 42.3
If they win: 42 pts (profit: 12 pts)

New odds: Team Alpha 24¢ (+4¢)
Balance: 70 pts remaining
```

### Other commands

- `leaderboard` — top 10 users by points
- `my bets` — list active positions with current value
- `balance` — show current point balance

---

## Admin Commands

Sent by admin phone numbers (configured via ADMIN_NUMBERS env var). All start with `/`.

| Command | Action |
|---------|--------|
| `/addteam [market#] [Team Name]` | Add a team to a market |
| `/removeteam [market#] [team#]` | Remove team (only if no bets placed on it) |
| `/resolve [market#] [team#]` | Resolve market, pay winning shareholders |
| `/markets` | List all markets with status and team count |
| `/addpoints [phone] [amount]` | Give a user more points |

### Hackathon day setup flow

1. Arrive at hackathon, learn team names
2. `/addteam 1 Team Alpha`, `/addteam 1 Team Beta`, ... (for all 3 markets)
3. Share bot number with spectators
4. When winners announced: `/resolve 1 3` (team #3 won 1st)
5. `/resolve 2 5` (team #5 got 2nd), `/resolve 3 1` (team #1 got 3rd)

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Bet on same team across markets | Allowed — independent markets |
| Team added after bets placed | Fine — new team starts at shares_sold=0, LMSR prices adjust |
| User out of points | "You're out of points! Watch the odds and cheer." |
| Market resolved with no bets | Close silently, no payouts |
| User bets more than balance | Reject with balance info |
| Team removed after bets | Block removal, show error |
| No teams added yet | "Markets aren't set up yet. Check back soon!" |

---

## Implementation Notes

- Create branch `hackathon-predictions` from `main`
- New migration file for multi-outcome tables
- New service: `src/modules/markets/multiMarkets.service.js`
- Simplified message handler that auto-registers and routes to predict flow
- Admin handler updated with new commands
- No fee on winnings (keep it fun and simple)
- Existing binary market code left in place but unused
