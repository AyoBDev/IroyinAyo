import { TrendingUp, Target, Flame, Award, ArrowUpRight, ArrowDownRight, Share2 } from 'lucide-react';
import useStore from '../store.js';

function PredictorCard({ user }) {
  const accuracy = user.accuracy ?? 0;
  const streak = user.streak ?? 0;
  const weeklyRank = user.weekly_rank ?? null;
  const title = user.title ?? 'Newcomer';

  return (
    <div style={{
      background: 'linear-gradient(145deg, var(--bg-card), var(--bg-secondary))',
      borderRadius: 'var(--radius-xl)', padding: '24px',
      border: '1px solid var(--border)', textAlign: 'center',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%',
        background: 'var(--accent-green-bg)', border: '2px solid var(--accent-green-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px',
      }}>
        <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
          {user.name?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{user.name}</h2>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', borderRadius: '12px',
        background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)',
        marginBottom: '16px',
      }}>
        <Award size={12} color="var(--accent-blue)" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>{title}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
            {accuracy}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Accuracy</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Flame size={16} color="var(--accent-yellow)" />
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{streak}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Week Streak</div>
        </div>
        {weeklyRank && (
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-yellow)' }}>
              #{weeklyRank}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>This Week</div>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          const text = `${user.name} — ${title} on IroyinMarket\n${accuracy}% accuracy | ${streak} week streak${weeklyRank ? ` | Ranked #${weeklyRank}` : ''}\n\nPredict & compete for cash: ${window.location.origin}`;
          if (navigator.share) {
            navigator.share({ text });
          } else {
            navigator.clipboard.writeText(text);
          }
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', marginTop: '16px', padding: '12px',
          background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)',
          borderRadius: '9999px', color: 'var(--accent-blue)',
          fontSize: '12px', fontWeight: 700,
        }}
      >
        <Share2 size={13} /> Share Profile
      </button>
    </div>
  );
}

export default function Profile() {
  const user = useStore((s) => s.user);
  const positions = useStore((s) => s.positions);

  if (!user) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <PredictorCard user={user} />

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '10px', marginTop: '16px',
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          padding: '16px', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Balance</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-green)' }}>
            {user.points_balance} pts
          </div>
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          padding: '16px', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Predictions</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {positions.length}
          </div>
        </div>
      </div>

      {/* Prediction History */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginTop: '16px',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <TrendingUp size={14} color="var(--accent-green)" />
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Prediction History
          </h3>
        </div>

        {positions.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <Target size={24} color="var(--text-tertiary)" style={{ marginBottom: '10px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>
              No predictions yet
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Pick your first market to start building your record.
            </p>
          </div>
        ) : (
          <div style={{ padding: '6px' }}>
            {positions.slice(0, 20).map((pos) => {
              const isWin = pos.payout > 0;
              const isResolved = pos.market_status === 'resolved';
              return (
                <div key={pos.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 'var(--radius)',
                  margin: '2px 0', minHeight: '44px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pos.market_title}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{pos.outcome_label}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    {isResolved ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isWin ? <ArrowUpRight size={14} color="var(--accent-green)" /> : <ArrowDownRight size={14} color="var(--accent-red)" />}
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isWin ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {isWin ? `+${pos.payout}` : 'Lost'}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {Number(pos.shares).toFixed(1)} shares
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
