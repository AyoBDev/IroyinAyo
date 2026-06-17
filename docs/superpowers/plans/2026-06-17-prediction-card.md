# Prediction Confirmation & Share Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "I'm Calling It" confirmation overlay that appears after placing a prediction, with share-as-image and share-as-link functionality.

**Architecture:** New `PredictionCard` component (reusable for overlay and share page), `PredictionConfirmation` overlay triggered from PredictSlip after successful submission, `ShareSheet` bottom sheet for share options. New backend endpoint for public position data. New route for the public share page.

**Tech Stack:** React, Tailwind CSS, Zustand, html2canvas (new dependency), navigator.share API

**Follow-up (not in this plan):** OpenGraph meta tags for rich link previews require server-side HTML injection (since the frontend is a Vite SPA). This can be added later as a backend middleware that intercepts crawler requests to `/share/prediction/:id`.

---

## File Structure

```
prediction-web/src/
├── components/
│   ├── PredictionCard.jsx          — standalone card (the visual slip)
│   ├── PredictionConfirmation.jsx  — overlay wrapper (backdrop, buttons)
│   └── ShareSheet.jsx              — bottom sheet with share options
├── pages/
│   └── SharePrediction.jsx         — public share page (/share/prediction/:id)
├── App.jsx                         — add new route
├── store.js                        — (no changes needed)
└── styles/
    └── global.css                  — add scale-in animation

iroyinayo/src/modules/markets/
└── multiMarkets.routes.js          — add public position endpoint
```

---

### Task 1: Install html2canvas

**Files:**
- Modify: `prediction-web/package.json`

- [ ] **Step 1: Install dependency**

Run:
```bash
cd prediction-web && npm install html2canvas
```

- [ ] **Step 2: Verify install**

Run:
```bash
cd prediction-web && node -e "require('html2canvas'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add prediction-web/package.json prediction-web/package-lock.json
git commit -m "deps: add html2canvas for prediction card image export"
```

---

### Task 2: Add scale-in animation to global.css

**Files:**
- Modify: `prediction-web/src/styles/global.css`

- [ ] **Step 1: Add the animation keyframes and variable**

In `prediction-web/src/styles/global.css`, inside the `@theme { }` block, after the existing `--animate-pop-in` line (line 72), add:

```css
  --animate-scale-in: scale-in 0.2s ease-out;
```

Then, after the existing `@keyframes pop-in` block (after line 95), add:

```css
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
```

- [ ] **Step 2: Verify the dev server still builds**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/styles/global.css
git commit -m "style: add scale-in animation for prediction confirmation overlay"
```

---

### Task 3: Create PredictionCard component

**Files:**
- Create: `prediction-web/src/components/PredictionCard.jsx`

- [ ] **Step 1: Create the component**

Create `prediction-web/src/components/PredictionCard.jsx`:

```jsx
import { forwardRef } from 'react';

const PredictionCard = forwardRef(function PredictionCard({
  marketTitle,
  outcomeLabel,
  probability,
  amount,
  potentialPayout,
  username,
  timestamp,
}, ref) {
  const returnMultiplier = amount > 0 ? (potentialPayout / amount).toFixed(1) : '0.0';
  const percentDisplay = Math.round(probability * 100);
  const dateStr = new Date(timestamp).toLocaleDateString('en-NG', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      ref={ref}
      className="w-[360px] max-w-full bg-bone rounded-2xl border border-line p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <span className="font-serif text-[15px] text-ink italic font-semibold">
          IroyinMarket
        </span>
        <span className="font-mono text-mono-label text-ink-muted">
          {dateStr}
        </span>
      </div>

      {/* Declaration */}
      <div className="text-center mb-5">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-ink-muted mb-2">
          I'M CALLING IT
        </div>
        <div className="font-serif text-[28px] font-bold text-emerald mb-1">
          {outcomeLabel}
        </div>
        <div className="font-serif text-[15px] text-ink leading-snug max-w-[240px] mx-auto line-clamp-2">
          {marketTitle}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-ink-muted">
            Confidence
          </span>
          <span className="font-mono text-[12px] font-semibold text-accent-green">
            {percentDisplay}%
          </span>
        </div>
        <div className="h-1.5 bg-paper rounded-full border border-line overflow-hidden">
          <div
            className="h-full bg-accent-green rounded-full transition-all"
            style={{ width: `${percentDisplay}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center p-3 bg-paper rounded-lg">
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-ink">{amount}</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">Staked</div>
        </div>
        <div className="w-px h-8 bg-line" />
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-accent-green">{potentialPayout}</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">To Win</div>
        </div>
        <div className="w-px h-8 bg-line" />
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-ink">{returnMultiplier}x</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">Return</div>
        </div>
      </div>

      {/* Username */}
      <div className="text-center mt-3">
        <span className="font-mono text-[11px] text-ink-muted">@{username}</span>
      </div>
    </div>
  );
});

export default PredictionCard;
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/components/PredictionCard.jsx
git commit -m "feat: add PredictionCard component for confirmation/share slip"
```

---

### Task 4: Create ShareSheet component

**Files:**
- Create: `prediction-web/src/components/ShareSheet.jsx`

- [ ] **Step 1: Create the component**

Create `prediction-web/src/components/ShareSheet.jsx`:

```jsx
import { useState } from 'react';
import { Image, Link2, Share2, Check, X } from 'lucide-react';

export default function ShareSheet({ onShareImage, onCopyLink, onShareLink, onClose }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  function handleCopyLink() {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[400px] bg-bone rounded-t-2xl border border-line border-b-0 p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-serif text-[15px] font-semibold text-ink">Share prediction</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-paper text-ink-muted hover:bg-paper-hover"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onShareImage}
            className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
          >
            <Image size={18} className="text-emerald" />
            <span className="text-label-sm font-medium text-ink">Share as Image</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
          >
            {copied
              ? <Check size={18} className="text-accent-green" />
              : <Link2 size={18} className="text-emerald" />
            }
            <span className="text-label-sm font-medium text-ink">
              {copied ? 'Link copied!' : 'Copy Link'}
            </span>
          </button>

          {canNativeShare && (
            <button
              onClick={onShareLink}
              className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
            >
              <Share2 size={18} className="text-emerald" />
              <span className="text-label-sm font-medium text-ink">Share Link</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/components/ShareSheet.jsx
git commit -m "feat: add ShareSheet component for prediction share options"
```

---

### Task 5: Create PredictionConfirmation overlay

**Files:**
- Create: `prediction-web/src/components/PredictionConfirmation.jsx`

- [ ] **Step 1: Create the component**

Create `prediction-web/src/components/PredictionConfirmation.jsx`:

```jsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import html2canvas from 'html2canvas';
import PredictionCard from './PredictionCard.jsx';
import ShareSheet from './ShareSheet.jsx';

export default function PredictionConfirmation({ data, onClose }) {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shareUrl = `${window.location.origin}/share/prediction/${data.positionId}`;

  const handleShareImage = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#fbf7ef',
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'prediction.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `I'm calling it: ${data.outcomeLabel}`,
            text: `${data.marketTitle} — ${Math.round(data.probability * 100)}% confidence`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'prediction.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
    setShowShareSheet(false);
  }, [data]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareLink = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: `I'm calling it: ${data.outcomeLabel}`,
        text: `${data.marketTitle} — ${Math.round(data.probability * 100)}% confidence`,
        url: shareUrl,
      });
    }
    setShowShareSheet(false);
  }, [data, shareUrl]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative flex flex-col items-center animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-paper border border-line text-ink-muted hover:bg-paper-hover z-10"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* The card */}
        <PredictionCard
          ref={cardRef}
          marketTitle={data.marketTitle}
          outcomeLabel={data.outcomeLabel}
          probability={data.probability}
          amount={data.amount}
          potentialPayout={data.potentialPayout}
          username={data.username}
          timestamp={data.timestamp}
        />

        {/* Action buttons */}
        <div className="w-full max-w-[360px] mt-4 flex flex-col gap-2.5">
          <button
            onClick={() => setShowShareSheet(true)}
            className="w-full py-3.5 bg-emerald text-bone rounded-xl text-label-sm font-semibold hover:bg-emerald-deep transition-colors"
          >
            Share
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-transparent text-ink-muted rounded-xl text-label-sm font-medium hover:text-ink transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Share sheet */}
      {showShareSheet && (
        <ShareSheet
          onShareImage={handleShareImage}
          onCopyLink={handleCopyLink}
          onShareLink={handleShareLink}
          onClose={() => setShowShareSheet(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/components/PredictionConfirmation.jsx
git commit -m "feat: add PredictionConfirmation overlay with share functionality"
```

---

### Task 6: Integrate into PredictSlip

**Files:**
- Modify: `prediction-web/src/components/PredictSlip.jsx:1-60`

- [ ] **Step 1: Add state and import**

At the top of `prediction-web/src/components/PredictSlip.jsx`, add the import after the existing imports (after line 4):

```jsx
import PredictionConfirmation from './PredictionConfirmation.jsx';
```

Inside the `PredictSlip` component function (after line 35, the `const openAuthModal = ...` line), add:

```jsx
  const [confirmationData, setConfirmationData] = useState(null);
```

- [ ] **Step 2: Modify handleSubmit to show confirmation**

Replace the `handleSubmit` function (lines 47-60) with:

```jsx
  async function handleSubmit() {
    if (amountNum < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await placePrediction(market.id, outcome.id, amountNum);
      fetchPositions();
      setConfirmationData({
        positionId: result.position.id,
        marketTitle: market.title,
        outcomeLabel: outcome.label,
        probability: outcome.price,
        amount: amountNum,
        potentialPayout: payout,
        username: user?.username || user?.phone || 'user',
        timestamp: result.position.created_at || new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 3: Add confirmation overlay render**

At the very end of the `PredictSlip` component return statement, just before the final closing `</div>` of the component's return (before line 167), add:

```jsx
      {confirmationData && (
        <PredictionConfirmation
          data={confirmationData}
          onClose={() => { setConfirmationData(null); onClose(); }}
        />
      )}
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add prediction-web/src/components/PredictSlip.jsx
git commit -m "feat: show prediction confirmation card after successful prediction"
```

---

### Task 7: Add public position endpoint (backend)

**Files:**
- Modify: `iroyinayo/src/modules/markets/multiMarkets.routes.js`

- [ ] **Step 1: Add the endpoint**

In `iroyinayo/src/modules/markets/multiMarkets.routes.js`, add a new route before the `/:id/predict` route (before line 430):

```javascript
router.get('/positions/:positionId/public', async (req, res, next) => {
  try {
    const position = await db('multi_market_positions')
      .where({ 'multi_market_positions.id': req.params.positionId })
      .join('multi_markets', 'multi_markets.id', 'multi_market_positions.market_id')
      .join('multi_market_outcomes', 'multi_market_outcomes.id', 'multi_market_positions.outcome_id')
      .join('students', 'students.id', 'multi_market_positions.student_id')
      .select(
        'multi_market_positions.id as position_id',
        'multi_market_positions.amount',
        'multi_market_positions.entry_price',
        'multi_market_positions.shares',
        'multi_market_positions.created_at',
        'multi_markets.title as market_title',
        'multi_markets.id as market_id',
        'multi_market_outcomes.label as outcome_label',
        'students.username'
      )
      .first();

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const potentialPayout = position.amount > 0
      ? Math.floor(position.amount / position.entry_price)
      : 0;

    res.json({
      positionId: position.position_id,
      marketId: position.market_id,
      marketTitle: position.market_title,
      outcomeLabel: position.outcome_label,
      probability: position.entry_price,
      amount: position.amount,
      potentialPayout,
      username: position.username || 'user',
      timestamp: position.created_at,
    });
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Verify the server starts**

Run:
```bash
cd iroyinayo && node -e "const r = require('./src/modules/markets/multiMarkets.routes.js'); console.log('OK')" 2>&1 | head -5
```
Expected: Either `OK` or a non-syntax error (database not configured in test env is fine).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/markets/multiMarkets.routes.js
git commit -m "feat: add public position endpoint for prediction share cards"
```

---

### Task 8: Create SharePrediction page

**Files:**
- Create: `prediction-web/src/pages/SharePrediction.jsx`

- [ ] **Step 1: Create the page**

Create `prediction-web/src/pages/SharePrediction.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import PredictionCard from '../components/PredictionCard.jsx';

export default function SharePrediction() {
  const { positionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/multi-markets/positions/${positionId}/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [positionId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={24} className="text-emerald animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-ink-muted text-body-sm mb-4">Prediction not found</p>
        <Link to="/" className="text-emerald text-[13px] font-semibold">
          Go to Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <PredictionCard
        marketTitle={data.marketTitle}
        outcomeLabel={data.outcomeLabel}
        probability={data.probability}
        amount={data.amount}
        potentialPayout={data.potentialPayout}
        username={data.username}
        timestamp={data.timestamp}
      />

      <div className="w-full max-w-[360px] mt-5">
        <Link
          to={`/market/${data.marketId}`}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald rounded-xl text-bone text-label-sm font-semibold no-underline hover:bg-emerald-deep transition-colors"
        >
          Make your own prediction <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/pages/SharePrediction.jsx
git commit -m "feat: add public SharePrediction page for shared prediction links"
```

---

### Task 9: Add route to App.jsx

**Files:**
- Modify: `prediction-web/src/App.jsx:17-123`

- [ ] **Step 1: Add import**

In `prediction-web/src/App.jsx`, after the existing `ShareCard` import (line 17), add:

```jsx
import SharePrediction from './pages/SharePrediction.jsx';
```

- [ ] **Step 2: Add route**

In the top-level `<Routes>` inside the `App` component (line 121), after the existing share route, add the new route:

```jsx
        <Route path="/share/prediction/:positionId" element={<SharePrediction />} />
```

The routes section (lines 120-123) should now look like:

```jsx
      <Routes>
        <Route path="/share/:marketId" element={<ShareCard />} />
        <Route path="/share/prediction/:positionId" element={<SharePrediction />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd prediction-web && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add prediction-web/src/App.jsx
git commit -m "feat: add /share/prediction/:positionId route"
```

---

### Task 10: Manual QA

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run:
```bash
cd prediction-web && npm run dev
```

- [ ] **Step 2: Test the confirmation flow**

1. Open the app in browser
2. Sign in (if not already)
3. Find any open market and tap an outcome
4. Enter an amount and submit
5. Verify: confirmation overlay appears with the "I'M CALLING IT" card
6. Verify: card shows correct outcome, market title, odds, staked/payout/return values
7. Verify: "Done" button dismisses the overlay
8. Verify: Escape key dismisses the overlay
9. Verify: tapping backdrop dismisses the overlay

- [ ] **Step 3: Test the share flow**

1. Place another prediction
2. When confirmation appears, tap "Share"
3. Verify: ShareSheet slides up with options
4. Tap "Copy Link" — verify clipboard has correct URL format
5. Tap "Share as Image" — verify PNG downloads (desktop) or share sheet opens (mobile)

- [ ] **Step 4: Test the share page**

1. Copy the share URL from step 3
2. Open in a new incognito tab
3. Verify: the PredictionCard renders with correct data
4. Verify: "Make your own prediction" button links to the correct market

- [ ] **Step 5: Test edge cases**

1. Find a market with a long title (>2 lines) — verify it truncates with ellipsis
2. Find a multi-outcome market with a long outcome label — verify it fits
3. Test with dark mode toggled — verify colors adapt

---
