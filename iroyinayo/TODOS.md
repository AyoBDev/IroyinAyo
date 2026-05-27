# TODOS

## P1 — Blocks or critical for launch

### Email OTP Fallback via Resend
- **What:** Abstract OTP delivery behind a provider interface. Add Resend email as fallback when WhatsApp bot is disconnected or banned.
- **Why:** Baileys uses unofficial WhatsApp APIs that get numbers banned. A ban = total auth outage. Email fallback ensures users can still log in.
- **Context:** auth.service.js throws when bot is null (after D4 fix lands). The abstraction: try WhatsApp first, fall back to email if bot unavailable. Resend SDK is ~20 lines of integration. Free tier: 100 emails/day.
- **Depends on:** D4 fix (throw when bot disconnected) must ship first.
- **Files:** `src/modules/auth/auth.service.js`, new `src/modules/auth/otp-provider.js`

### Weekly Leaderboard Reset (Monday 00:00 WAT)
- **What:** Implement fixed Monday-Sunday weekly periods instead of rolling 7-day window. Add qualification rules (3+ predictions) and tiebreaker (accuracy %).
- **Why:** The weekly prize is the retention hook. Without a proper Monday reset, there's no "weekly winner announcement" moment.
- **Context:** getLeaderboard() currently does rolling 7-day sum. After net-profit rewrite (D7), still needs fixed periods, qualification, and archival of past weeks.
- **Depends on:** D7 net-profit rewrite.
- **Files:** `src/modules/gamification/gamification.service.js`, new migration for `weekly_leaderboard_snapshots` table

## P2 — Should land same branch or next sprint

### Market Resolution Dispute Mechanism
- **What:** Add a resolution delay window (1 hour) and dispute mechanism before payouts finalize. Students can flag with evidence.
- **Why:** One bad resolution on a small campus kills trust permanently. Currently admin resolves and payouts happen instantly with no recourse.
- **Context:** resolveMarket() instantly pays winners. Design doc mentions 48-hour dispute window. Start simpler: 1-hour delay + notification before finalization.
- **Depends on:** WhatsApp notification service for alerting users of pending resolutions.
- **Files:** `src/modules/markets/multiMarkets.service.js`, new `disputed_resolutions` table

## P3 — Follow-up / deferred

### Create DESIGN.md via /design-consultation
- **What:** Run `/design-consultation` to produce a comprehensive DESIGN.md with component vocabulary, token reference, spacing/typography scales, and do/don't examples.
- **Why:** The plan has a quick design system spec (from design review) but no full reference document. As component count grows past 20+, each new feature risks visual drift without a codified system.
- **Context:** Plan-level spec covers spacing scale, min sizes, color tokens, and typography choice (Space Grotesk/DM Sans). Full DESIGN.md would add component patterns, interaction states template, and usage guidelines.
- **Depends on:** Nothing (can run anytime after implementation starts).
- **Files:** New `DESIGN.md` at project root

### WhatsApp Cloud API Migration
- **What:** Migrate from Baileys (unofficial) to WhatsApp Cloud API (official).
- **Why:** Baileys numbers get banned. Cloud API is the stable long-term solution.
- **Context:** Accepted tech debt from CEO review. Migrate when scaling past single campus.
- **Depends on:** Meta Business verification, WhatsApp Business API access.
