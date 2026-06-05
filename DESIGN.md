# Design System — IroyinMarket (Recivo Warm Editorial)

## Product Context
- **What this is:** Campus prediction market where students predict hackathon winners and football outcomes, competing for cash prizes
- **Who it's for:** Nigerian university students (18-25), socially competitive, mobile-first
- **Space/industry:** Social gaming / prediction markets / campus entertainment
- **Project type:** Real-time social web app (mobile-first, dashboard-like for markets)
- **Memorable thing:** "This feels like a game I play with my friends, not a betting site."

## Aesthetic Direction
- **Direction:** Warm Editorial — cream parchment backgrounds, serif display headings, flat cards with subtle borders. Recivo-inspired editorial confidence.
- **Decoration level:** Minimal — flat surfaces, no shadows on cards, shadows only on floating elements (modals, toasts, FABs)
- **Mood:** Confident, polished, editorial. Feels designed by a human, not AI-generated. Campus energy with grown-up taste.
- **Differentiation from peers:** Polymarket is cold fintech. Manifold is playful tech startup. Sportybet is dense gambling. IroyinMarket is warm editorial gaming — your accuracy IS your reputation.

## Typography
- **Display/Hero:** Fraunces (editorial serif, tight leading, negative tracking — brand confidence)
- **Body:** Instrument Sans (clean sans-serif, OpenType features enabled)
- **UI/Labels:** Instrument Sans 500 weight
- **Data/Tables:** JetBrains Mono (monospace for aligned numbers, percentages, scores)
- **Loading:** Self-hosted woff2 from `/public/fonts/`
- **Font stacks:**
  - Serif: `'Fraunces', ui-serif, Georgia, serif`
  - Sans: `'Instrument Sans', ui-sans-serif, system-ui, sans-serif`
  - Mono: `'JetBrains Mono', ui-monospace, monospace`
- **OpenType features:** `"calt", "cv11", "kern", "ss01", "ss02", "ss03"`
- **Scale:**
  - hero: 80px / 76px line-height / -2px tracking (Fraunces)
  - section: 26px / 26px line-height / -0.65px tracking (Fraunces)
  - body: 16px / 24.8px line-height / -0.08px tracking (Instrument Sans 400)
  - body-sm: 14px / 21.7px line-height / -0.08px tracking (Instrument Sans 400)
  - label: 15px / 23.25px line-height / -0.08px tracking (Instrument Sans 500)
  - label-sm: 13.5px / 20.925px line-height / -0.08px tracking (Instrument Sans 400)
  - mono-label: 11px / 17.05px line-height / 1.76px tracking (JetBrains Mono)
  - mono-data: 11.5px / 17.825px line-height / 2.53px tracking (JetBrains Mono)

## Color — Light Theme (Primary)
- **Background (bone):** #fbf7ef (warm off-white parchment)
- **Surface/Card (paper):** #f4efe6 (slightly deeper parchment)
- **Surface hover (paper-hover):** #ede7db
- **Primary CTA (emerald):** #0f3d2e (deep forest green)
- **Primary hover (emerald-deep):** #144d39
- **Decorative (gold):** #e6c764 (warm gold highlights)
- **Decorative secondary (ochre):** #b08923
- **Text primary (ink):** #14110f (near-black warm)
- **Text secondary (ink-deep):** #2a2521 (nav text)
- **Text muted (ink-muted):** #6b6055 (captions, metadata)
- **Border (line):** #d6cdb8 (warm dividers)

## Color — Semantic Accents (Warmed)
- **Green:** #2d8a6e (wins, profit, positive) / bg: rgba(45,138,110,0.08) / border: rgba(45,138,110,0.25)
- **Red:** #c44b4b (losses, errors, destructive) / bg: rgba(196,75,75,0.08) / border: rgba(196,75,75,0.25)
- **Yellow:** #c9922a (rank, trophies, streaks) / bg: rgba(201,146,42,0.08) / border: rgba(201,146,42,0.25)
- **Violet:** #8b6cc4 (gamification, badges, XP, titles) / bg: rgba(139,108,196,0.08) / border: rgba(139,108,196,0.2)

## Color — Dark Theme (Warm Dark Variant)
- **Background (bone):** #1a1714
- **Surface/Card (paper):** #242019
- **Surface hover (paper-hover):** #2e2920
- **Primary CTA (emerald):** #2ed49a (inverted for contrast)
- **Primary hover (emerald-deep):** #25b07f
- **Decorative (gold):** #e6c764
- **Decorative secondary (ochre):** #d4a833 (brightened)
- **Text primary (ink):** #f4efe6
- **Text secondary (ink-deep):** #e0d9ce
- **Text muted (ink-muted):** #a89a8a
- **Border (line):** #3d3529

Dark semantic accents use the same hex values — they have sufficient contrast on dark backgrounds.

### Color Usage Rules
- Green = money/wins/positive. Never decorative.
- Yellow = rank/achievement/celebration. Trophies, crowns, streaks.
- Emerald = interactive/navigation/CTA. Active tabs, primary buttons, selected states.
- Violet = identity/gamification. Titles (Oracle, Prophet), badges, XP.
- Red = loss/error/destructive. Never for decoration.
- Gold/Ochre = decorative only. Headlines, stickers, highlights.

## Spacing
- **Base unit:** 4px
- **Scale:** xs(4px) sm(8px) md(12px) base(16px) lg(20px) xl(24px) 2xl(28px) 3xl(32px) 4xl(40px) 5xl(48px) 6xl(64px) 7xl(80px) 8xl(128px)
- **Touch targets:** 44px minimum height/width for all interactive elements
- **Card padding:** 16-20px internal, 12px gap between cards
- **Page padding:** 16px on mobile, 24px on desktop

## Layout
- **Mobile:** Single column
- **Desktop (900px+):** 2-column grid — main content (1fr) + sidebar (300px)
- **Max content width:** 1400px
- **Border radius:** sm(4px) md(6px) lg(8px) xl(12px) 2xl(16px) 3xl(24px) full(9999px)
- **Navigation:** Bottom tab bar on mobile (Markets | Leaderboard | Profile), top bar only on desktop
- **Breakpoint:** 900px (single breakpoint, mobile-first)

## Depth & Shadows
- **Cards:** Flat. No shadow. Background: paper, border: 1px line, radius: 2xl.
- **Floating elements (modals, toasts, dropdowns):** shadow-float `0 4px 16px rgba(20,17,15,0.08)` (light) / `0 4px 16px rgba(0,0,0,0.3)` (dark)
- **Large floats:** shadow-float-lg `0 8px 32px rgba(20,17,15,0.12)` (light) / `0 8px 32px rgba(0,0,0,0.4)` (dark)
- **Modal overlay:** `rgba(20,17,15,0.4)` + `backdrop-filter: blur(8px)`

## Motion
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - Button press: scale(0.97) over 120ms
  - Card entrance: fadeIn + translateY(-4px) over 200ms
  - Odds tick up: green flash + scale(1.08) over 400ms
  - Odds tick down: red flash + scale(1.08) over 400ms
  - Toast slide: slideUp from bottom over 300ms
  - Page transition: fadeIn over 200ms

## Component Patterns
- **Cards:** bg-paper, border border-line, rounded-2xl, no shadow, hover: bg-paper-hover
- **Buttons (primary):** bg-emerald text-bone rounded-xl, hover: bg-emerald-deep, press: scale(0.97)
- **Buttons (secondary):** bg-paper text-ink border border-line rounded-xl
- **Inputs:** bg-bone border border-line rounded-lg, focus: emerald border + ring
- **TopBar:** bg-bone border-b border-line, logo in font-serif, nav in font-sans 13.5px
- **BottomNav:** bg-paper/90 backdrop-blur-md border-t border-line, 64px height
- **Toasts:** bg-paper border border-line rounded-2xl shadow-float, 3px accent left border

## Do's and Don'ts
| Do | Don't |
|----|-------|
| Use bone/paper contrast for layer separation | Don't add shadows to cards |
| Use emerald only for the primary action per screen | Don't use emerald decoratively |
| Keep mono fonts for data/numbers only | Don't use JetBrains Mono for labels or body |
| Maintain 44px minimum touch targets | Don't shrink interactive elements below this |
| Use line color for all borders consistently | Don't mix border colors within a view |
| Maintain WCAG AA contrast (4.5:1 normal text) | Don't place ink-muted on paper without checking |

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-20 | Initial design system created | Competitive research (Polymarket, Manifold, Sportybet) |
| 2026-06-05 | Full Recivo redesign adopted | Warm editorial aesthetic — polished, not AI-generated, fresh direction |
| 2026-06-05 | Self-hosted fonts (Fraunces, Instrument Sans, JetBrains Mono) | Better performance/privacy vs CDN |
| 2026-06-05 | Migrated to Tailwind CSS | Utility classes mapped to design tokens for maintainability |
| 2026-06-05 | Flat cards, shadows for floats only | Matches editorial flatness; overlays need visual separation |
| 2026-06-05 | Keep dark mode (warm variant) | User preference; derived warm darks from palette |
