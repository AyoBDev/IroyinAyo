# Iroyinayo

WhatsApp-based information and gamification platform for University of Ilorin students. Students interact via WhatsApp to receive personalized content, answer quizzes, trade on prediction markets, and redeem rewards.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌────────────┐
│  WhatsApp Bot    │────▶│  Express API │◀────│   Admin    │
│  (Baileys)       │     │  (Port 3000) │     │  Dashboard │
└─────────────────┘     └──────┬───────┘     │  (Next.js) │
                               │              │  Port 3001 │
                        ┌──────▼───────┐     └────────────┘
                        │  PostgreSQL   │
                        └──────────────┘
```

**Backend modules:** Students, Content, Gamification (points/quizzes/streaks), Prediction Markets, Rewards, Admin

**Bot features:** Onboarding, personalized feed, daily quizzes, prediction markets, point redemption, admin commands

**AI Pipeline:** Daily content generation via Claude API (6 AM WAT), admin-triggered generation

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+

### Setup

```bash
# Clone and install
cd iroyinayo
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and API keys

# Run migrations
npm run migrate

# Start (API + bot)
npm start

# Or API only (no WhatsApp bot)
npm run start:api-only
```

### Admin Dashboard

```bash
cd iroyinayo-admin
npm install
cp .env.local.example .env.local
npm run dev
```

### Docker

From the parent directory containing both projects:

```bash
docker compose up
```

This starts PostgreSQL, the backend (API + bot), and the admin dashboard.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/admin/register | Register admin |
| POST | /api/admin/login | Admin login |
| GET | /api/admin/analytics | Dashboard stats |
| GET | /api/students | List students |
| GET | /api/students/:id | Get student |
| POST | /api/admin/students/:id/ban | Ban student |
| POST | /api/admin/students/:id/unban | Unban student |
| GET | /api/content | List content |
| POST | /api/content | Create content |
| POST | /api/content/generate | AI generate content |
| POST | /api/content/:id/approve | Approve content |
| POST | /api/content/:id/publish | Publish content |
| GET | /api/content/feed/:studentId | Personalized feed |
| GET | /api/gamification/quizzes | List quizzes |
| POST | /api/gamification/quizzes | Create quiz |
| GET | /api/gamification/leaderboard | Leaderboard |
| GET | /api/markets/all | List all markets |
| POST | /api/markets | Create market |
| POST | /api/markets/:id/approve | Approve market |
| POST | /api/markets/:id/resolve | Resolve market |
| POST | /api/markets/:id/sponsor | Sponsor market |
| GET | /api/rewards/options | List reward options |
| POST | /api/rewards/options | Create reward option |
| GET | /api/rewards/pending | Pending redemptions |
| POST | /api/rewards/:id/fulfill | Fulfill redemption |

## WhatsApp Commands

**Student commands:** menu, quiz, points, leaderboard, interests, predict, my predictions, redeem, help

**Admin commands** (ADMIN_NUMBERS only): /stats, /broadcast, /approve, /resolve, /ban, /topup

## Scheduled Jobs

| Time | Job |
|------|-----|
| 6 AM WAT | AI content generation (all categories) |
| 8 AM WAT | Morning digest (top 3 personalized items) |
| 12 PM WAT | Midday quiz notification |
| Hourly | Auto-close expired markets |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Secret for admin JWT tokens |
| PORT | No | API port (default: 3000) |
| CORS_ORIGIN | No | Allowed origins, comma-separated |
| ENABLE_BOT | No | Start WhatsApp bot (default: true) |
| ADMIN_NUMBERS | No | WhatsApp admin numbers, comma-separated |
| ANTHROPIC_API_KEY | No | Claude API key for AI content |

## Testing

```bash
npm test
```

89 tests across 15 suites covering API endpoints, bot handlers, and AI content utilities.
