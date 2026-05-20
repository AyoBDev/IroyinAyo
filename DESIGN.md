# Design System — IroyinMarket

## Product Context
- **What this is:** Campus prediction market where students predict hackathon winners and football outcomes, competing for cash prizes
- **Who it's for:** Nigerian university students (18-25), socially competitive, mobile-first
- **Space/industry:** Social gaming / prediction markets / campus entertainment
- **Project type:** Real-time social web app (mobile-first, dashboard-like for markets)
- **Memorable thing:** "This feels like a game I play with my friends, not a betting site."

## Aesthetic Direction
- **Direction:** Playful meets Industrial — rounded bouncy UI elements with data-dense market cards. Discord meets a sports app.
- **Decoration level:** Intentional — subtle gradients on hero cards, glowing accents on live markets, grain on empty states
- **Mood:** Fun, competitive, identity-driven. Social energy like a group chat about sports, not cold fintech or aggressive gambling
- **Differentiation from peers:** Polymarket is cold fintech. Manifold is playful tech startup. Sportybet is dense gambling. IroyinMarket is campus social gaming — your accuracy IS your reputation.

## Typography
- **Display/Hero:** Satoshi (geometric, confident, slightly rounded — game brand energy without shouting)
- **Body:** DM Sans (clean readability, pairs with Satoshi, supports tabular-nums for odds)
- **UI/Labels:** DM Sans 500-600 weight
- **Data/Tables:** DM Sans with font-variant-numeric: tabular-nums (aligned percentage columns)
- **Code:** JetBrains Mono
- **Loading:** Satoshi via Fontshare CDN (`https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap`), DM Sans via Google Fonts
- **Scale:**
  - xs: 10px — timestamps, labels
  - sm: 11px — badges, captions
  - base: 13px — body text, outcome rows
  - md: 14px — card titles, nav items
  - lg: 16px — section headings
  - xl: 18px — page titles, profile name
  - 2xl: 22px — hero stats
  - 3xl: 28px — big percentage displays
  - display: 42px — marketing hero

## Color
- **Approach:** Restrained but punchy — few colors, each with clear purpose
- **Background:** #0A0E17 (deep navy-black, warmer than pure black)
- **Surface/Card:** #141B2D (blue-tinted dark)
- **Surface hover:** #1A2338
- **Border:** #1E2940 (subtle blue edge)
- **Border light:** #283550 (emphasis borders)
- **Text primary:** #F0F4F8 (warm white)
- **Text muted:** #7B8BA3 (steel blue — secondary info)
- **Text dim:** #4A5568 (tertiary — timestamps, labels)
- **Accent green:** #10B981 (emerald — wins, profit, positive actions)
- **Accent green bg:** rgba(16, 185, 129, 0.08)
- **Accent green border:** rgba(16, 185, 129, 0.25)
- **Accent yellow:** #F59E0B (amber — crowns, trophies, streaks, rank #1)
- **Accent yellow bg:** rgba(245, 158, 11, 0.08)
- **Accent indigo:** #6366F1 (primary accent — CTAs, active states, navigation)
- **Accent indigo bg:** rgba(99, 102, 241, 0.08)
- **Accent indigo border:** rgba(99, 102, 241, 0.2)
- **Accent red:** #EF4444 (losses, errors, destructive actions)
- **Accent red bg:** rgba(239, 68, 68, 0.08)
- **Accent violet:** #A78BFA (gamification layer — titles, badges, XP, level-ups)
- **Accent violet bg:** rgba(167, 139, 250, 0.08)
- **Accent violet border:** rgba(167, 139, 250, 0.2)

### Color Usage Rules
- Green = money/wins/positive. Never decorative.
- Yellow = rank/achievement/celebration. Trophies, crowns, streaks.
- Indigo = interactive/navigation/CTA. Active tabs, primary buttons, selected states.
- Violet = identity/gamification. Titles (Oracle, Prophet), badges, XP.
- Red = loss/error/destructive. Never for decoration.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — not cramped like Sportybet, not wasteful like Manifold
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Touch targets:** 44px minimum height/width for all interactive elements
- **Card padding:** 16-20px internal, 10-12px gap between cards
- **Page padding:** 16px on mobile, 24px on desktop

## Layout
- **Approach:** Grid-disciplined with playful card sizes
- **Mobile:** Single column, masonry for market cards (break-inside: avoid)
- **Desktop (900px+):** 2-column grid — main content (1fr) + sidebar (300px)
- **Max content width:** 1400px
- **Border radius:** sm: 6px (inputs, outcome rows), lg: 12px (cards, modals), xl: 16px (hero cards, profile card), full: 9999px (pills, avatars, buttons)
- **Navigation:** Bottom tab bar on mobile (Markets | Leaderboard | Profile), top bar only on desktop
- **Breakpoint:** 900px (single breakpoint, mobile-first)

## Motion
- **Approach:** Intentional — every animation has a purpose, never gratuitous
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 50-100ms (button press scale, toggle switch)
  - short: 150-250ms (card entrance, odds tick animation, tab switch)
  - medium: 250-400ms (page transition, celebration burst, toast slide-in)
  - long: 400-700ms (resolution confetti, share card generation)
- **Specific animations:**
  - Odds tick: color flash (green up, red down) + scale(1.08) over 400ms
  - Button press: scale(0.97) over 120ms
  - Card entrance: fadeIn + translateY(-4px) over 200ms
  - Resolution toast: slideUp from bottom over 300ms
  - Market resolve: gradient border pulse + trophy entrance

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-20 | Initial design system created | /design-consultation based on competitive research (Polymarket, Manifold, Sportybet) and user's memorable-thing: gamification + social platform |
| 2026-05-20 | Indigo (#6366F1) as primary accent | Reads as social/gaming (Discord, Twitch) vs. fintech blue. Distinguishes from every betting app |
| 2026-05-20 | Violet (#A78BFA) for gamification layer | Separates identity system (titles, badges, XP) from market UI. Makes social identity impossible to miss |
| 2026-05-20 | Satoshi as display typeface | Geometric confidence without banking coldness. Brand recognition in screenshots/shares. Nobody in this space uses it |
| 2026-05-20 | DM Sans over Inter/system fonts | Pairs with Satoshi, supports tabular-nums for odds, feels designed without being heavy |
