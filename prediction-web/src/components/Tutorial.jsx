import { useState, useEffect } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import useStore from '../store.js';

const steps = [
  {
    target: '[data-tutorial="market-card"]',
    title: 'This is a market',
    content: 'A question people are predicting on. Pick the outcome you think is right.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="odds"]',
    title: 'These are the odds',
    content: "The percentage shows what the crowd thinks. Lower odds = bigger payout if you're right.",
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="predict-btn"]',
    title: 'Make your prediction',
    content: "Tap an outcome and choose how many points to wager. That's it.",
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="points-balance"]',
    title: 'Your points',
    content: "You start with free points. Spend them on predictions, win more when you're right.",
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="incentives"]',
    title: 'Win real prizes',
    content: 'Top predictors win cash prizes every week. The better your calls, the more you earn.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaderboard-tab"]',
    title: 'Compete with friends',
    content: 'See how you rank against others. Accuracy is everything.',
    disableBeacon: true,
    placement: 'top',
  },
];

function CustomTooltip({ continuous, index, step, primaryProps, skipProps, tooltipProps }) {
  return (
    <div
      {...tooltipProps}
      style={{
        background: '#f4efe6',
        border: '1px solid #d6cdb8',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: '280px',
        width: 'calc(100vw - 32px)',
        fontFamily: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
        boxSizing: 'border-box',
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

function scrollTargetIntoView(target) {
  const el = document.querySelector(target);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const topBarHeight = 70;
  const bottomNavHeight = 80;
  const safeTop = topBarHeight + 20;
  const safeBottom = viewportHeight - bottomNavHeight - 200;

  if (rect.top < safeTop || rect.bottom > safeBottom) {
    const scrollTo = window.scrollY + rect.top - topBarHeight - 40;
    window.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
  }
}

function getStorageKey(userId) {
  return `iroyinmarket_tutorial_seen_${userId}`;
}

export default function Tutorial() {
  const user = useStore((s) => s.user);
  const markets = useStore((s) => s.markets);
  const tutorialRunRequested = useStore((s) => s.tutorialRunRequested);
  const clearTutorialReplay = useStore((s) => s.clearTutorialReplay);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!user || markets.length === 0) return;
    const seen = localStorage.getItem(getStorageKey(user.id));
    if (!seen) {
      const timer = setTimeout(() => {
        setStepIndex(0);
        setRun(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user, markets.length]);

  useEffect(() => {
    if (tutorialRunRequested) {
      setStepIndex(0);
      setRun(true);
      clearTutorialReplay();
    }
  }, [tutorialRunRequested, clearTutorialReplay]);

  const handleCallback = (data) => {
    const { status, type, index, action } = data;

    if (type === EVENTS.STEP_BEFORE) {
      scrollTargetIntoView(steps[index].target);
    }

    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);
      if (user) {
        localStorage.setItem(getStorageKey(user.id), 'true');
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      disableScrolling
      spotlightClicks={false}
      tooltipComponent={CustomTooltip}
      callback={handleCallback}
      floaterProps={{
        disableAnimation: true,
        offset: 8,
      }}
      styles={{
        options: {
          overlayColor: 'rgba(20, 17, 15, 0.6)',
          zIndex: 1000,
        },
      }}
    />
  );
}
