# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the IroyinMarket Express.js backend (`iroyinayo/`). The `posthog-node` SDK is initialized in a shared utility module and wired into the Express app via `setupExpressRequestContext` (for automatic request metadata and client session correlation) and `setupExpressErrorHandler` (for automatic exception capture). Graceful shutdown handlers flush any queued events on SIGINT/SIGTERM. Events are captured at each key business action across auth, markets, rewards, and referrals.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | New student completes OTP verification and creates an account | `iroyinayo/src/modules/auth/auth.service.js` |
| `user_logged_in` | Returning student verifies OTP and logs in | `iroyinayo/src/modules/auth/auth.service.js` |
| `quick_join_completed` | Student registers via quick-join flow without OTP | `iroyinayo/src/modules/auth/auth.service.js` |
| `prediction_placed` | Student buys a yes/no position on a binary market | `iroyinayo/src/modules/markets/markets.service.js` |
| `multi_prediction_placed` | Student buys a position on a multi-outcome market | `iroyinayo/src/modules/markets/multiMarkets.service.js` |
| `market_resolved` | Admin resolves a binary market and distributes payouts | `iroyinayo/src/modules/markets/markets.service.js` |
| `multi_market_resolved` | Admin or creator resolves a multi-outcome market | `iroyinayo/src/modules/markets/multiMarkets.service.js` |
| `reward_redeemed` | Student redeems points for a cash or airtime reward | `iroyinayo/src/modules/rewards/rewards.service.js` |
| `referral_applied` | Referral code successfully applied, bonuses granted | `iroyinayo/src/modules/referrals/referrals.service.js` |
| `ambassador_promoted` | Student auto-promoted to ambassador at 10 referrals | `iroyinayo/src/modules/referrals/referrals.service.js` |
| `market_approved` | Admin approves a student-submitted market proposal | `iroyinayo/src/modules/markets/markets.service.js` |
| `market_created` | Admin creates a new binary prediction market | `iroyinayo/src/modules/markets/markets.service.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/480069/dashboard/1741995)
- [New Signups](https://us.posthog.com/project/480069/insights/1Z42W6ez) — Daily signup trend (30 days)
- [Daily Predictions Placed](https://us.posthog.com/project/480069/insights/6S3AG6z4) — Binary + multi-outcome prediction volume (30 days)
- [Signup to First Prediction Funnel](https://us.posthog.com/project/480069/insights/W1ZF9KuX) — Conversion rate from signup → first prediction (7-day window)
- [Rewards Redeemed](https://us.posthog.com/project/480069/insights/03I02Win) — Weekly reward redemptions (90 days)
- [Referral & Ambassador Growth](https://us.posthog.com/project/480069/insights/WcGbZigJ) — Referrals and ambassador promotions (90 days)

## Verify before merging

- [ ] Run `npm install` inside `iroyinayo/` to install `posthog-node` (the sandbox could not write to `node_modules` during the wizard run — the dependency has been added to `package.json`).
- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Confirm the returning-visitor path also calls `identify` — `verifyCode` in `auth.service.js` now calls `identify` on both new and returning students, but verify this fires correctly in your staging environment.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
