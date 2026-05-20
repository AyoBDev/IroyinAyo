import { Crown, Trophy, Target, TrendingUp } from 'lucide-react';
import useStore from '../store.js';

export default function LeaderboardPage() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);

  const myPredictionCount = user?.weekly_predictions ?? 0;
  const qualified = myPredictionCount >= 3;

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Prize Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent-green-bg), var(--accent-yellow-bg))',
        border: '1px solid var(--accent-green-border)',
        borderRadius: 'var(--radius-xl)', padding: '20px',
        marginBottom: '16px', textAlign: 'center',
      }}>
        <Trophy size={24} color="var(--accent-yellow)" style={{ marginBottom: '8px' }} />
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
          Cash Prize This Week
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Top predictor wins real money every Monday
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '20px',
          background: qualified ? 'var(--accent-green-bg)' : 'var(--bg-card)',
          border: `1px solid ${qualified ? 'var(--accent-green-border)' : 'var(--border)'}`,
        }}>
          <Target size={14} color={qualified ? 'var(--accent-green)' : 'var(--text-tertiary)'} />
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: qualified ? 'var(--accent-green)' : 'var(--text-secondary)',
          }}>
            {qualified
              ? 'You qualify this week!'
              : `${myPredictionCount}/3 predictions to qualify`}
          </span>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crown size={14} color="var(--accent-yellow)" />
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Weekly Rankings
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Resets Monday</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <TrendingUp size={28} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>
              Be the first on the leaderboard!
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Make 3+ predictions this week to qualify for the cash prize.
            </p>
          </div>
        ) : (
          <div style={{ padding: '6px' }}>
            {leaderboard.map((entry, i) => {
              const isMe = user && entry.id === user.id;
              const rankColors = ['#facc15', '#94a3b8', '#d97706'];
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    background: isMe ? 'var(--accent-blue-bg)' : 'transparent',
                    border: isMe ? '1px solid var(--accent-blue-border)' : '1px solid transparent',
                    margin: '2px 0',
                    minHeight: '44px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '12px', width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      background: i < 3 ? `${rankColors[i]}15` : 'var(--bg-secondary)',
                      color: i < 3 ? rankColors[i] : 'var(--text-tertiary)',
                      fontWeight: 800,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>
                      {entry.name}
                      {isMe && <span style={{ color: 'var(--accent-blue)', marginLeft: '6px', fontSize: '11px', fontWeight: 600 }}>you</span>}
                    </span>
                  </div>
                  <span style={{
                    fontWeight: 700, fontSize: '14px',
                    color: i < 3 ? 'var(--accent-green)' : 'var(--text-secondary)',
                  }}>
                    {Number(entry.total_points)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
