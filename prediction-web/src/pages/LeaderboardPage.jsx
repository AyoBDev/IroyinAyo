import { useState, useEffect } from 'react';
import { Crown, Trophy, Target, TrendingUp, ChevronDown } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';

export default function LeaderboardPage() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);
  const [pastWeeks, setPastWeeks] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    apiFetch('/api/multi-markets/leaderboard/history')
      .then(setPastWeeks)
      .catch(() => {});
  }, []);

  const myEntry = leaderboard.find(e => user && e.id === user.id);
  const qualified = myEntry ? myEntry.predictions >= 3 : false;

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
          Top net profit wins real money every Monday
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
              : `${myEntry?.predictions || 0}/3 predictions to qualify`}
          </span>
        </div>
      </div>

      {/* Past Winners */}
      {pastWeeks.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '12px 16px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Crown size={14} color="var(--accent-yellow)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Last week's winner</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pastWeeks[0].winner_name || 'No winner'}
              {pastWeeks[0].winner_profit > 0 && (
                <span style={{ color: 'var(--accent-green)', marginLeft: '8px', fontSize: '12px' }}>
                  +{pastWeeks[0].winner_profit} profit
                </span>
              )}
            </div>
          </div>
        </div>
      )}

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
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Net Profit · Resets Monday</span>
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
              const profit = entry.netProfit ?? entry.total_points ?? 0;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    background: isMe ? 'var(--accent-blue-bg)' : 'transparent',
                    border: isMe ? '1px solid var(--accent-blue-border)' : '1px solid transparent',
                    margin: '2px 0', minHeight: '44px',
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
                      {entry.rank || i + 1}
                    </span>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>
                        {entry.name}
                        {isMe && <span style={{ color: 'var(--accent-blue)', marginLeft: '6px', fontSize: '11px', fontWeight: 600 }}>you</span>}
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                        {entry.predictions || 0} predictions · {entry.wins || 0} wins
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontWeight: 700, fontSize: '14px',
                    color: profit > 0 ? 'var(--accent-green)' : profit < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                  }}>
                    {profit > 0 ? '+' : ''}{profit}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Weeks Toggle */}
      {pastWeeks.length > 1 && (
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
              background: 'transparent', padding: '8px 0',
            }}
          >
            <ChevronDown size={14} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            Past weeks
          </button>
          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {pastWeeks.slice(1).map((week) => (
                <div key={week.id} style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {new Date(week.week_start).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} — {new Date(week.week_end).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                      {week.winner_name || 'No winner'}
                    </div>
                  </div>
                  {week.winner_profit > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>
                      +{week.winner_profit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
