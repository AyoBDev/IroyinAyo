# Hackathon Prediction Market Web App

## Overview

A Polymarket-inspired web app that lets hackathon spectators view live odds and place bets on which teams will win 1st/2nd/3rd place. Complements the WhatsApp bot — same accounts, same markets, real-time sync.

**Auth:** JWT token embedded in a link sent from WhatsApp bot. No login form.  
**Stack:** React (Vite) + Socket.IO client, backed by the existing Express API with Socket.IO added.  
**Deploy:** Static frontend on Railway alongside the API.

---

## Auth Flow

1. WhatsApp bot sends personalized link: `yourapp.com?t=<jwt>`
2. JWT payload: `{ studentId }`, signed with `process.env.JWT_SECRET`, 7-day expiry
3. React app reads token from URL query param on first load, stores in localStorage
4. All authenticated API requests send `Authorization: Bearer <token>` header
5. Socket.IO connection sends token in `auth` handshake
6. If token missing/expired: show a "Get your link from WhatsApp" screen with the bot number
7. `web` command in bot regenerates link anytime. Link also auto-sent after registration.

---

## Single Page Layout

### Top Bar
- Left: Hackathon name/logo
- Right: Point balance (live-updating), "My Positions" button

### Main Content — Market Cards

Three cards stacked vertically (1st place, 2nd place, 3rd place):

- **Card header:** Market title (e.g., "Who will win 1st place?")
- **Outcome rows:** One row per team
  - Left: Team name
  - Right: Probability percentage + price in cents (e.g., "42¢")
  - Background: subtle probability bar (low-opacity fill proportional to price)
  - Delta indicator: small "+3¢" or "-2¢" badge when odds shift, fades after 3 seconds
  - Tap/click row → expands inline bet slip below

### Inline Bet Slip (Polymarket-style)

Expands below the tapped outcome row, no modal:

- Amount input (number field, pre-filled buttons: 10, 25, 50, All-in)
- Live calculation: "You'll get X shares → payout Y pts if they win"
- Confirm button: "Bet [amount] on [team]"
- Cancel: tap outside or X button collapses it
- Error state: "Insufficient points" shown inline

### Activity Feed

- Desktop: right sidebar (fixed, ~300px wide)
- Mobile: horizontal ticker at top OR collapsible bottom sheet
- Shows last 20 trades in real-time: "🎯 Someone bet 40 pts on Team Alpha (1st place)"
- Auto-scrolls as new bets arrive
- Anonymized — no names, just "Someone"

### Leaderboard

- Section below market cards
- Top 10 users by point balance
- Columns: Rank | Name (phone last 4 digits) | Balance
- Highlight current user's row

### My Positions (Slide-out Panel)

- Triggered by "My Positions" button in top bar
- Lists all active bets: market title, team picked, amount spent, shares held, potential payout
- Resolved bets: shows win/loss with actual payout

---

## Real-Time (Socket.IO)

### Server Events (emitted to all clients)

| Event | Payload | Trigger |
|-------|---------|---------|
| `odds:update` | `{ marketId, outcomes: [{ id, price }] }` | Any bet placed (web or WhatsApp) |
| `bet:placed` | `{ marketId, outcomeLabel, amount }` | Any bet placed |
| `market:resolved` | `{ marketId, winnerLabel, winnerId }` | Admin resolves market |
| `balance:update` | `{ studentId, balance }` | Sent privately to affected user |

### Client Behavior

- On `odds:update`: animate price changes (number ticks up/down, green/red flash)
- On `bet:placed`: prepend to activity feed
- On `market:resolved`: show celebration overlay (confetti or flash), update card to "Resolved: [winner]"
- On `balance:update`: update top-bar balance with animation

---

## Visual Design (Polymarket-inspired)

### Colors
- Background: `#131722` (charcoal)
- Card surface: `#1e2230`
- Card border: `#2a2e3d`
- Text primary: `#ffffff`
- Text secondary: `#8a8f9c`
- Accent green: `#4ade80` (gains, positive delta)
- Accent red: `#f87171` (losses, negative delta)
- Accent blue: `#3b82f6` (primary buttons, active states)

### Typography
- Font: Inter (or system font stack as fallback)
- Prices: 24px bold
- Team names: 16px medium
- Secondary text: 14px regular
- Activity feed: 13px regular

### Layout Principles
- Generous whitespace, no clutter
- Minimal borders — use spacing and background contrast
- Cards have subtle rounded corners (12px)
- Probability bars: colored fill at 10% opacity behind outcome rows
- No heavy gradients or glowing effects — clean and professional
- Mobile-first: cards stack full-width, feed moves to bottom

### Animations
- Price change: number counter animation (ticks from old to new value over 400ms)
- Delta badge: fade in, stays 3s, fades out
- Bet slip: slide-down expand (200ms ease)
- Activity feed: new items slide in from top
- Market resolved: brief green flash on winning row, confetti particles (3s)

---

## API Endpoints

All prefixed with `/api` on the existing Express server.

### Public (no auth)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/multi-markets` | `[{ id, title, status, outcomes: [{ id, label, price }] }]` |
| GET | `/api/multi-markets/:id` | Single market with outcomes and prices |
| GET | `/api/leaderboard` | `[{ name, balance, rank }]` top 10 |

### Authenticated (JWT Bearer token)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/me` | — | `{ id, name, points_balance }` |
| GET | `/api/me/positions` | — | `[{ market_title, outcome_label, amount, shares, payout, market_status }]` |
| POST | `/api/multi-markets/:id/bet` | `{ outcomeId, amount }` | `{ position, market }` |

### Auth Middleware

- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `process.env.JWT_SECRET`
- Attaches `req.studentId` from payload
- Returns 401 with `{ error: "Invalid or expired token" }` on failure

---

## Bot Changes

### New `web` command
- User types `web` → bot generates JWT for that student, sends link
- Message: "📱 Play on the web: [link]"

### Auto-send after registration
- After auto-registration (first message), bot sends markets AND the web link
- Message: "You can also bet from your browser: [link]"

### Socket.IO integration
- When `buyPosition` is called (from bot handler), emit `odds:update` and `bet:placed` to all connected Socket.IO clients
- When `resolveMarket` is called (from admin handler), emit `market:resolved`
- Require Socket.IO server instance to be accessible from the message handler (pass via app context or singleton)

---

## Project Structure (Frontend)

```
prediction-web/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api.js              — API client (fetch + token)
│   ├── socket.js           — Socket.IO client setup
│   ├── store.js            — Zustand store (markets, user, positions)
│   ├── components/
│   │   ├── TopBar.jsx
│   │   ├── MarketCard.jsx
│   │   ├── OutcomeRow.jsx
│   │   ├── BetSlip.jsx
│   │   ├── ActivityFeed.jsx
│   │   ├── Leaderboard.jsx
│   │   ├── MyPositions.jsx
│   │   └── NoAuth.jsx
│   └── styles/
│       └── global.css
```

### Dependencies
- `react`, `react-dom`
- `socket.io-client`
- `zustand` (lightweight state management)
- `vite` (build tool)

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Invalid/expired token | Show "Get your link" screen with WhatsApp bot number |
| User bets more than balance | API returns error, bet slip shows "Insufficient points" inline |
| Market resolved while viewing | `market:resolved` event updates card to show winner, disables betting |
| No teams added yet | Market card shows "Coming soon — teams will be added shortly" |
| WebSocket disconnects | Auto-reconnect with exponential backoff, show subtle "reconnecting..." badge |
| Same user on web + WhatsApp | Same account, same balance — updates sync via Socket.IO |
| Mobile viewport | Cards full-width, activity feed as bottom ticker, bet slip as bottom sheet |

---

## Implementation Order

1. Backend: Add JWT generation + verification middleware
2. Backend: Add REST API endpoints for multi-markets
3. Backend: Add Socket.IO server with event emissions
4. Backend: Update bot to emit Socket.IO events on bets/resolution
5. Backend: Add `web` command + auto-send link
6. Frontend: Scaffold Vite + React project
7. Frontend: API client + auth (token from URL → localStorage)
8. Frontend: Socket.IO client + Zustand store
9. Frontend: Market cards + outcome rows with live prices
10. Frontend: Inline bet slip
11. Frontend: Activity feed
12. Frontend: Leaderboard + My Positions
13. Frontend: Animations and polish
