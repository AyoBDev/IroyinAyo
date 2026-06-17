# Prediction Confirmation & Share Card

## Summary

A modal card that appears after a user submits a prediction. Serves as both a confirmation receipt and a shareable social asset. Uses a "declaration" style — "I'M CALLING IT" — to make predictions feel like bold statements worth sharing.

## Card Layout

Top-to-bottom structure:

1. **Header row**: IroyinMarket logo/wordmark (italic Fraunces, 15px) left-aligned, timestamp (JetBrains Mono, 11px, ink-muted) right-aligned.
2. **Declaration label**: "I'M CALLING IT" — mono-label scale (JetBrains Mono, 10px, uppercase, letter-spacing 2px, ink-muted). Centered.
3. **Outcome**: The user's picked outcome in large Fraunces serif (28px, bold). Color: emerald always (this is the user's pick — it's always a positive/confident statement). Centered.
4. **Market title**: Below outcome, Fraunces 15px, ink color, centered, max-width 240px with line clamping at 2 lines.
5. **Confidence bar**: Shows the probability at time of prediction. Left label "Confidence" (mono-label), right label shows percentage (JetBrains Mono, 12px, emerald). Bar: 6px height, paper background with line border, emerald fill proportional to probability.
6. **Stats container**: Rounded container (radius-lg, paper background). Three columns separated by 1px line dividers:
   - Staked: amount in pts (mono, 16px, ink)
   - To Win: potential payout (mono, 16px, accent-green)
   - Return: multiplier (mono, 16px, ink)
   - Each has an uppercase label below (mono, 10px, ink-muted)
7. **Username**: @handle centered below stats (mono, 11px, ink-muted).

## Card Styling

- Background: bone (#fbf7ef)
- Border: 1px solid line (#d6cdb8)
- Border radius: rounded-2xl (16px)
- Padding: xl (24px)
- No shadow (flat card per design system)
- Dark mode: uses dark theme equivalents from DESIGN.md

## Overlay Behavior

### Trigger
Appears immediately after a successful prediction API response (not optimistic — wait for server confirmation to ensure accuracy of payout/odds data).

### Animation
- Backdrop: ink at 40% opacity + backdrop-filter blur(8px)
- Card entrance: fadeIn 200ms + scale from 0.95 to 1.0 (easing: ease-out)
- Card exit: fadeOut 150ms + scale to 0.95

### Dismiss
- Tap/click backdrop
- X button in overlay top-right corner (outside the card itself)
- "Done" button

### Action Buttons
Rendered below the card, inside the overlay but outside the card border:
- **"Share"** — primary button (emerald background, white text, rounded-xl). Triggers share flow.
- **"Done"** — ghost button (transparent background, ink-muted text). Dismisses overlay.

Buttons are full-width, stacked vertically, Share on top.

## Share Flow

### Image Share (PNG)
1. Render the card element to a canvas using `html2canvas`.
2. Convert to PNG blob.
3. If `navigator.share` is available (mobile), invoke with the image file.
4. Fallback (desktop): download the PNG directly.

Image dimensions: card renders at fixed 360px width for consistent output regardless of screen size.

### Link Share
1. Generate URL: `/share/prediction/{positionId}`
2. This routes to a public page showing the same card layout.
3. Below the card on the public page: "Make your own prediction" CTA button linking to the market.
4. Page includes OpenGraph meta tags for link previews:
   - `og:title`: "@{username} is calling it: {outcome}"
   - `og:description`: "{market_title} — {odds}% confidence"
   - `og:image`: Server-rendered PNG of the card (or a generic branded image as fallback)

### Share Options UI
When user taps "Share", show a small bottom sheet with:
- "Share as Image" — triggers image flow
- "Copy Link" — copies the share URL to clipboard with a brief toast confirmation
- "Share Link" — triggers `navigator.share` with URL (mobile only, hidden on desktop)

## Data Requirements

The card needs these values available at render time (all returned from the prediction API response):

| Field | Source |
|-------|--------|
| market_title | market object |
| outcome_label | selected outcome |
| probability | outcome price at time of prediction (from API response) |
| amount | user's staked points |
| potential_payout | calculated payout (from API response) |
| return_multiplier | payout / amount |
| username | current user's handle |
| timestamp | prediction created_at |
| position_id | for generating share link |
| category | market category (for share page context) |

## Component Structure

```
PredictionConfirmation/
├── PredictionConfirmation.jsx   — overlay wrapper (backdrop, animation, buttons)
├── PredictionCard.jsx           — the card itself (reused in share page)
└── ShareSheet.jsx               — bottom sheet with share options
```

`PredictionCard.jsx` is a standalone component that accepts props and renders the card. This allows reuse in:
- The confirmation overlay (after prediction)
- The public share page (`/share/prediction/:id`)
- Image generation (render off-screen for html2canvas)

## Integration Points

### Frontend
- **PredictSlip.jsx**: After successful prediction, instead of just closing, show the PredictionConfirmation overlay with the response data.
- **App.jsx / Router**: Add route for `/share/prediction/:id` pointing to a SharePrediction page.
- **SharePrediction page**: Fetches position data from API, renders PredictionCard with a CTA below.

### Backend
- **New endpoint**: `GET /api/multi-markets/positions/:id/public` — returns position data needed to render the share card (market title, outcome, odds, amount, payout, username). No auth required (public share page).
- **OpenGraph**: The share page needs server-rendered meta tags. Since the frontend is a Vite SPA, OG tags can be injected via a lightweight server middleware or a separate OG endpoint that returns HTML for crawlers.

## Accessibility
- Overlay traps focus when open
- Escape key dismisses
- Card content is semantically structured (not just visual divs)
- Share buttons have aria-labels

## Edge Cases
- Very long market titles: clamp at 2 lines with ellipsis
- Multi-outcome markets: outcome label may be longer than "Yes/No" — card accommodates up to ~30 characters before truncating
- User dismisses before share: card data is lost (no persistent state needed — they can find it in portfolio)
- Network error on prediction: overlay never appears (only shows on success)
- Share API unavailable (older browsers): fall back to "Copy Link" only
