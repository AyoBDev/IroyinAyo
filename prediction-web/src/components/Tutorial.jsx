import { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { HelpCircle } from 'lucide-react';
import useStore from '../store.js';

const steps = [
  {
    target: '[data-tutorial="market-card"]',
    title: 'This is a market',
    content: 'A question people are predicting on. Pick the outcome you think is right.',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="odds"]',
    title: 'These are the odds',
    content: "The percentage shows what the crowd thinks. Lower odds = bigger payout if you're right.",
  },
  {
    target: '[data-tutorial="predict-btn"]',
    title: 'Make your prediction',
    content: "Tap an outcome and choose how many points to wager. That's it.",
  },
  {
    target: '[data-tutorial="points-balance"]',
    title: 'Your points',
    content: "You start with free points. Spend them on predictions, win more when you're right.",
  },
  {
    target: '[data-tutorial="incentives"]',
    title: 'Win real prizes',
    content: 'Top predictors win cash prizes every week. The better your calls, the more you earn.',
  },
  {
    target: '[data-tutorial="leaderboard-tab"]',
    title: 'Compete with friends',
    content: 'See how you rank against others. Accuracy is everything.',
  },
];

function CustomTooltip({ continuous, index, step, backProps, primaryProps, skipProps, tooltipProps }) {
  return (
    <div
      {...tooltipProps}
      style={{
        background: '#f4efe6',
        border: '1px solid #d6cdb8',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: '300px',
        fontFamily: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {step.title && (
        <h4 style={{
          margin: '0 0 8px',
          fontSize: '18px',
          fontWeight: 700,
          color: '#14110f',
          fontFamily: "'Fraunces', ui-serif, Georgia, serif",
        }}>
          {step.title}
        </h4>
      )}
      <p style={{
        margin: '0 0 16px',
        fontSize: '14px',
        lineHeight: 1.5,
        color: '#6b6055',
      }}>
        {step.content}
      </p>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: i === index ? '#0f3d2e' : '#d6cdb8',
            }}
          />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          {...skipProps}
          style={{
            background: 'none', border: 'none', color: '#6b6055',
            fontSize: '13px', cursor: 'pointer', padding: '4px 0',
          }}
        >
          Skip
        </button>
        <button
          {...primaryProps}
          style={{
            background: '#0f3d2e', color: '#fbf7ef',
            padding: '8px 20px', borderRadius: '12px',
            fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
          }}
        >
          {continuous && index < steps.length - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </div>
  );
}

function getStorageKey(userId) {
  return `iroyinmarket_tutorial_seen_${userId}`;
}

export default function Tutorial() {
  const user = useStore((s) => s.user);
  const markets = useStore((s) => s.markets);
  const [run, setRun] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (!user || markets.length === 0) return;
    const seen = localStorage.getItem(getStorageKey(user.id));
    if (!seen) {
      const timer = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(timer);
    }
    setShowButton(true);
  }, [user, markets.length]);

  const handleCallback = (data) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setShowButton(true);
      if (user) {
        localStorage.setItem(getStorageKey(user.id), 'true');
      }
    }
  };

  const handleReplay = () => {
    setRun(true);
  };

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        continuous
        showSkipButton
        disableScrolling={false}
        spotlightClicks={false}
        tooltipComponent={CustomTooltip}
        callback={handleCallback}
        styles={{
          options: {
            overlayColor: 'rgba(20, 17, 15, 0.6)',
            zIndex: 1000,
          },
        }}
      />
      {showButton && (
        <button
          onClick={handleReplay}
          aria-label="Replay tutorial"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#0f3d2e',
            color: '#fbf7ef',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            cursor: 'pointer',
          }}
        >
          <HelpCircle size={20} />
        </button>
      )}
    </>
  );
}
