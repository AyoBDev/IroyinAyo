# IroyinMarket

Campus prediction market platform for Nigerian university students.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Project Structure

Monorepo with two main apps:

- `prediction-web/` — React 19 + Vite + Tailwind CSS 4 (user-facing frontend)
- `iroyinayo/` — Express.js backend + WhatsApp bot (Node.js, PostgreSQL, Socket.io)

### Deployment

- Railway deploys from `main` branch on push to GitHub
- Railway builds from the `iroyinayo/` Dockerfile (backend only)
- Frontend is pre-built and committed to `iroyinayo/public/` — this is what gets served
- After any frontend change, you MUST rebuild and copy to the public dir:
  ```bash
  cd prediction-web && npm run build
  rm iroyinayo/public/assets/* && cp -r dist/assets/* iroyinayo/public/assets/ && cp dist/index.html iroyinayo/public/index.html
  ```
- Then commit `iroyinayo/public/` changes and push

### Key Frontend Patterns

- **Share functionality**: All share flows use `src/shareImage.js` utility + `ShareSheet` component
  - `shareWithImage(element, { text, fileName })` — captures DOM element via html2canvas, shares with native API or downloads
  - `ShareSheet` component provides consistent bottom sheet with: Share as Image, Copy Link, Share Link
  - Used in: PredictionConfirmation, WinPopup, ProfileShareModal, MarketShareModal
- **Modals/Overlays**: Use `createPortal(jsx, document.body)` to escape overflow-hidden parents (MarketCard uses overflow-hidden)
- **State**: Zustand store (`src/store.js`), real-time updates via Socket.io
- **Styling**: Tailwind with CSS variables defined in `src/styles/global.css`, fonts: Fraunces (serif), Instrument Sans (sans), JetBrains Mono (mono)

### Key Backend Patterns

- LMSR automated market maker for pricing
- PostgreSQL via Knex (migrations in `iroyinayo/migrations/`)
- Socket.io for real-time odds/prediction/resolution events
- Phone-based auth with WhatsApp OTP
