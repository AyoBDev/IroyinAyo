import { useState, useEffect } from 'react';
import { Crown, Trophy, Target, TrendingUp, Star, ChevronDown } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';

function PodiumUser({ entry, rank, size }) {
  const initial = entry.name?.charAt(0)?.toUpperCase() || '?';
  const borderColors = ['var(--accent-green-border)', 'var(--border)', 'var(--accent-yellow-border)'];
  const bgColors = ['var(--accent-green-bg)', 'var(--bg-surface-container)', 'var(--accent-yellow-bg)'];
  const badgeBg = ['var(--accent-green-bg)', 'var(--bg-surface-container)', 'var(--accent-yellow-bg)'];
  const badgeColor = ['var(--accent-green)', 'var(--text-tertiary)', 'var(--accent-yellow)'];

  const avatarSize = size === 'lg' ? '72px' : size === 'md' ? '60px' : '52px';
  const fontSize = size === 'lg' ? '28px' : size === 'md' ? '22px' : '20px';
  const badgeSize = size === 'lg' ? '26px' : '22px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        {rank === 1 && (
          <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)' }}>
            <Crown size={22} color="var(--accent-yellow)" fill="var(--accent-yellow)" />
          </div>
        )}
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: '50%',
          border: `3px solid ${borderColors[rank - 1]}`,
          background: bgColors[rank - 1],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize, fontWeight: 800, color: badgeColor[rank - 1] }}>
            {initial}
          </span>
        </div>
        <div style={{
          position: 'absolute', bottom: '-4px', right: '-4px',
          width: badgeSize, height: badgeSize, borderRadius: '50%',
          background: badgeBg[rank - 1], border: '2px solid var(--bg-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 800, color: badgeColor[rank - 1],
        }}>
          {rank}
        </div>
      </div>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.name}
      </p>
      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)', marginTop: '2px' }}>
        +{entry.netProfit ?? entry.total_points ?? 0}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('weekly');
  const [pastWeeks, setPastWeeks] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    apiFetch('/api/multi-markets/leaderboard/history')
      .then(setPastWeeks)
      .catch(() => {});
  }, []);

  const myEntry = leaderboard.find(e => user && e.id === user.id);
  const qualified = myEntry ? myEntry.predictions >= 3 : false;
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Leaderboard</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Resets Monday
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '4px',
        background: 'var(--bg-surface-container)', borderRadius: 'var(--radius-xl)',
        marginBottom: '24px',
      }}>
        {['weekly', 'monthly', 'all-time'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 600,
              borderRadius: 'var(--radius-lg)',
              background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-tertiary)',
              boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
              border: 'none', textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Prize Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent-green-bg), var(--accent-yellow-bg))',
        border: '1px solid var(--accent-green-border)',
        borderRadius: 'var(--radius-xl)', padding: '16px 20px',
        marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Trophy size={20} color="var(--accent-yellow)" />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Cash Prize This Week</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Top net profit wins real money every Monday
          </p>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: '9999px',
          background: qualified ? 'var(--accent-green-bg)' : 'var(--bg-card)',
          border: `1px solid ${qualified ? 'var(--accent-green-border)' : 'var(--border)'}`,
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 600,
            color: qualified ? 'var(--accent-green)' : 'var(--text-tertiary)',
          }}>
            {qualified ? 'Qualified' : `${myEntry?.predictions || 0}/3`}
          </span>
        </div>
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
        <>
          {/* Podium Top 3 */}
          {top3.length >= 3 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              alignItems: 'end', gap: '8px', marginBottom: '24px',
              padding: '20px 8px 0',
            }}>
              <div style={{ paddingTop: '24px' }}>
                <PodiumUser entry={top3[1]} rank={2} size="md" />
              </div>
              <div>
                <PodiumUser entry={top3[0]} rank={1} size="lg" />
              </div>
              <div style={{ paddingTop: '32px' }}>
                <PodiumUser entry={top3[2]} rank={3} size="sm" />
              </div>
            </div>
          )}

          {/* List (4th onwards) */}
          {rest.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', padding: '8px 20px',
                fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span style={{ width: '28px' }}>#</span>
                <span style={{ flex: 1, marginLeft: '12px' }}>User</span>
                <span style={{ width: '60px', textAlign: 'right' }}>Accuracy</span>
                <span style={{ width: '70px', textAlign: 'right' }}>Profit</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rest.map((entry, i) => {
                  const rank = i + 4;
                  const isMe = user && entry.id === user.id;
                  const profit = entry.netProfit ?? entry.total_points ?? 0;
                  const accuracy = entry.accuracy ?? (entry.wins && entry.predictions ? Math.round((entry.wins / entry.predictions) * 100) : 0);

                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', padding: '12px 20px',
                      background: isMe ? 'var(--accent-blue-bg)' : 'var(--bg-card)',
                      border: `1px solid ${isMe ? 'var(--accent-blue-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-xl)',
                    }}>
                      <span style={{ width: '28px', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        {rank}
                      </span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'var(--bg-surface-container)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {entry.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {entry.name}
                            {isMe && <span style={{ color: 'var(--accent-blue)', marginLeft: '6px', fontSize: '10px', fontWeight: 600 }}>you</span>}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Star size={10} color="var(--primary)" fill="var(--primary)" />
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                              {entry.predictions || 0} predictions
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {accuracy}%
                      </span>
                      <span style={{
                        width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: 700,
                        color: profit > 0 ? 'var(--accent-green)' : profit < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                      }}>
                        {profit > 0 ? '+' : ''}{profit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Your Ranking */}
          {user && (
            <div style={{
              marginTop: '24px', paddingTop: '24px',
              borderTop: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginBottom: '12px' }}>
                Your Ranking
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', padding: '16px 20px',
                background: 'var(--primary-bg)', border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-xl)',
              }}>
                <span style={{ width: '28px', fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                  {myEntry ? (leaderboard.indexOf(myEntry) + 1) : '—'}
                </span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'var(--primary-bg)', border: '2px solid var(--primary-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                      {user.name} (You)
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Star size={10} color="var(--primary)" fill="var(--primary)" />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {myEntry?.predictions || 0} predictions
                      </span>
                    </div>
                  </div>
                </div>
                <span style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                  {myEntry?.accuracy ?? (myEntry?.wins && myEntry?.predictions ? Math.round((myEntry.wins / myEntry.predictions) * 100) : 0)}%
                </span>
                <span style={{
                  width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: 700,
                  color: (myEntry?.netProfit ?? myEntry?.total_points ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {(myEntry?.netProfit ?? myEntry?.total_points ?? 0) > 0 ? '+' : ''}
                  {myEntry?.netProfit ?? myEntry?.total_points ?? 0}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Past Winners */}
      {pastWeeks.length > 0 && (
        <div style={{ marginTop: '24px' }}>
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
              {pastWeeks.map((week) => (
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
