import { useState } from 'react';
import { HelpCircle, X, TrendingUp, Coins, Target, Users, ChevronRight } from 'lucide-react';

const steps = [
  {
    icon: Coins,
    title: 'Get Points',
    description: 'You start with free points. If you ever run out, we auto-refill your balance so you can keep predicting.',
  },
  {
    icon: Target,
    title: 'Make Predictions',
    description: 'Browse markets and predict outcomes. The price shows what the crowd thinks the probability is.',
  },
  {
    icon: TrendingUp,
    title: 'Prices Move',
    description: 'When more people predict an outcome, its price goes up. Predict early on the right outcome to earn more.',
  },
  {
    icon: Users,
    title: 'Win Points',
    description: 'When a market resolves, correct predictions pay out. The earlier you predicted, the bigger your payout.',
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px', width: '100%',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', color: 'var(--text-secondary)',
          fontSize: '13px', fontWeight: 600,
        }}
      >
        <HelpCircle size={15} color="var(--accent-blue)" />
        How It Works
        <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)', width: '100%', maxWidth: '420px',
            overflow: 'hidden', animation: 'slideUp 0.2s ease-out',
          }}>
            <div style={{
              padding: '18px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>How It Works</h2>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'var(--bg-secondary)', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', border: 'none',
                }}
              >
                <X size={14} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: '14px', marginBottom: i < steps.length - 1 ? '20px' : 0,
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} color="var(--accent-blue)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius)',
                background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green-border)',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>
                  Points are free and refill automatically. There is no real money involved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
