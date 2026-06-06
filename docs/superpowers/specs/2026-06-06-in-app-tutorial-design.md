# In-App Tutorial — Design Spec

## Goal

Guided tooltip walkthrough that teaches new users how IroyinMarket works by highlighting real UI elements on the Markets page. Auto-triggers on first visit, replayable via a "?" button.

## Architecture

- **Library:** react-joyride (tooltip walkthrough with spotlight overlay)
- **State:** `hasSeenTutorial` persisted in localStorage, keyed by user ID
- **Trigger:** Auto-starts on first authenticated visit to Markets page (after markets load)
- **Replay:** "?" floating button on Markets page restarts the tutorial on demand
- **Styling:** Custom tooltip component matching Recivo Warm Editorial design system

## Tutorial Steps

6 steps targeting real UI elements via `data-tutorial` attributes:

| Step | Target Selector | Title | Body |
|------|----------------|-------|------|
| 1 | `[data-tutorial="market-card"]` | "This is a market" | "A question people are predicting on. Pick the outcome you think is right." |
| 2 | `[data-tutorial="odds"]` | "These are the odds" | "The percentage shows what the crowd thinks. Lower odds = bigger payout if you're right." |
| 3 | `[data-tutorial="predict-btn"]` | "Make your prediction" | "Tap an outcome and choose how many points to wager. That's it." |
| 4 | `[data-tutorial="points-balance"]` | "Your points" | "You start with free points. Spend them on predictions, win more when you're right." |
| 5 | `[data-tutorial="incentives"]` | "Win real prizes" | "Top predictors win cash prizes every week. The better your calls, the more you earn." |
| 6 | `[data-tutorial="leaderboard-tab"]` | "Compete with friends" | "See how you rank against others. Accuracy is everything." |

## Target Elements

Each step points at an existing UI element on the Markets page:

1. **Market card** — first `.market-card` in the feed
2. **Odds** — an outcome percentage label within that card
3. **Predict button** — the outcome tap/predict action area
4. **Points balance** — points display in the top navigation bar
5. **Incentives** — the SocialProofBanner component (shows recent winners)
6. **Leaderboard tab** — leaderboard link in the bottom navigation bar

## Custom Tooltip Styling (Recivo Design System)

- **Background:** paper `#f4efe6`
- **Border:** 1px solid line `#d6cdb8`
- **Border radius:** 16px (rounded-2xl)
- **Title font:** Fraunces bold, ~20px, ink `#14110f`
- **Body font:** Instrument Sans 400, ~15px, ink-muted `#6b6055`
- **"Next" button:** emerald bg `#0f3d2e`, bone text `#fbf7ef`, rounded-xl
- **"Skip" link:** ink-muted text, no border/bg, always visible
- **Progress indicator:** small dots at bottom of tooltip showing current/total steps
- **Spotlight overlay:** `rgba(20, 17, 15, 0.6)` semi-transparent warm dark

## "?" Replay Button

- **Position:** fixed, bottom-right corner, above bottom nav (bottom: 80px, right: 16px)
- **Size:** 44px round (meets touch target minimum)
- **Style:** emerald bg `#0f3d2e`, white "?" text, no shadow (flat per design system)
- **Behavior:** tapping starts the tutorial from step 1 regardless of `hasSeenTutorial` state

## Persistence & Trigger Logic

- **Storage key:** `iroyinmarket_tutorial_seen_{userId}`
- **Trigger conditions (all must be true):**
  1. User is authenticated
  2. `hasSeenTutorial` is false (localStorage check)
  3. At least 1 market has loaded in the feed (elements exist to highlight)
- **On complete or skip:** set `hasSeenTutorial = true` in localStorage
- **Replay:** "?" button bypasses the localStorage check and restarts

## Joyride Configuration

- `continuous: true` — auto-advance with Next button
- `showSkipButton: true` — always visible
- `disableScrolling: false` — scrolls elements into view
- `spotlightClicks: false` — prevent interaction during tutorial
- `tooltipComponent: RecivTooltip` — custom styled tooltip
- `callback` handler to detect `STATUS.FINISHED` or `STATUS.SKIPPED` and persist completion

## Files to Create/Modify

- **Create:** `src/components/Tutorial.jsx` — joyride wrapper + custom tooltip + "?" button
- **Modify:** `src/pages/Markets.jsx` — add `data-tutorial` attributes to target elements, render `<Tutorial />`
- **Modify:** `package.json` — add `react-joyride` dependency

## Out of Scope

- Backend tracking of tutorial completion (localStorage only)
- A/B testing different step content
- Tutorial for other pages (portfolio, leaderboard)
- Animated illustrations within tooltips
