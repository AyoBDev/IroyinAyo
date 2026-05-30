import { useState, useEffect } from 'react';
import { TrendingUp, Target, Flame, Award, ArrowUpRight, ArrowDownRight, Share2, Copy, Check, Gift, Sun, Moon, Wallet, Star, History, Trophy } from 'lucide-react';
import { apiFetch, getToken } from '../api.js';
import useStore from '../store.js';
import { getTheme, toggleTheme } from '../theme.js';

function ReferralCard() {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    apiFetch('/api/referrals/me')
      .then(setStats)
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    const link = `${window.location.origin}?ref=${stats.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const link = `${window.location.origin}?ref=${stats.code}`;
    const text = `Join me on IroyinMarket! Predict hackathon winners & compete for cash. Use my code: ${stats.code}`;
    if (navigator.share) {
      navigator.share({ text, url: link });
    } else {
      handleCopy();
    }
  };

  const handleApply = async () => {
    if (!codeInput.trim()) return;
    setApplying(true);
    setMessage(null);
    try {
      const result = await apiFetch('/api/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      setMessage({ type: 'success', text: `+${result.referredBonus} pts bonus applied!` });
      setCodeInput('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setApplying(false);
  };

  if (!stats) return null;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden', marginTop: '24px',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <Gift size={14} color="var(--accent-violet)" />
        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Refer Friends
        </h3>
      </div>

      <div style={{ padding: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          You both get <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>50 pts</span> when a friend joins with your code.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          marginBottom: '10px',
        }}>
          <span style={{ flex: 1, fontSize: '15px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>
            {stats.code}
          </span>
          <button onClick={handleCopy} style={{
            padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
          }}>
            {copied ? <><Check size={12} color="var(--accent-green)" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>

        <button onClick={handleShare} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', padding: '12px', marginBottom: '14px',
          background: 'var(--accent-violet-bg)', border: '1px solid var(--accent-violet-border)',
          borderRadius: '9999px', color: 'var(--accent-violet)', fontSize: '12px', fontWeight: 700,
        }}>
          <Share2 size={13} /> Share Referral Link
        </button>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.referralCount}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Referred</div>
          </div>
          <div style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>+{stats.totalEarned}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Pts Earned</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 500 }}>Have a referral code?</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={8}
              style={{
                flex: 1, padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                letterSpacing: '1px', fontFamily: 'monospace',
              }}
            />
            <button
              onClick={handleApply}
              disabled={applying || !codeInput.trim()}
              style={{
                padding: '10px 16px', fontSize: '12px', fontWeight: 700,
                background: codeInput.trim() ? 'var(--accent-green)' : 'var(--bg-secondary)',
                color: codeInput.trim() ? '#fff' : 'var(--text-tertiary)',
                borderRadius: 'var(--radius)', border: 'none',
                opacity: applying ? 0.6 : 1,
              }}
            >
              Apply
            </button>
          </div>
          {message && (
            <div style={{
              marginTop: '8px', fontSize: '12px', fontWeight: 600,
              color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
            }}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);

  function handleToggle() {
    const next = toggleTheme();
    setThemeState(next);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      padding: '16px 20px', border: '1px solid var(--border)', marginTop: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {theme === 'dark' ? <Moon size={18} color="var(--text-secondary)" /> : <Sun size={18} color="var(--accent-yellow)" />}
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </span>
      </div>
      <button
        onClick={handleToggle}
        style={{
          position: 'relative', width: '44px', height: '24px',
          borderRadius: '12px', border: 'none',
          background: theme === 'dark' ? 'var(--accent-green)' : 'var(--border)',
          transition: 'background 0.2s',
        }}
        aria-label="Toggle theme"
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: theme === 'dark' ? '23px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

export default function Profile() {
  const openAuthModal = useStore((s) => s.openAuthModal);

  if (!getToken()) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Sign in to view your portfolio
        </p>
        <button
          onClick={openAuthModal}
          style={{
            background: 'var(--primary)', color: '#fff',
            padding: '10px 24px', borderRadius: '9999px', fontSize: '14px',
            fontWeight: 600, border: 'none',
          }}
        >
          Join IroyinMarket
        </button>
        <div style={{ maxWidth: '400px', margin: '24px auto 0' }}>
          <ThemeToggle />
        </div>
      </div>
    );
  }

  const user = useStore((s) => s.user);
  const positions = useStore((s) => s.positions);

  if (!user) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading profile...</p>
      </div>
    );
  }

  const accuracy = user.accuracy ?? 0;
  const streak = user.streak ?? 0;
  const title = user.title ?? 'Newcomer';
  const activePositions = positions.filter(p => p.market_status !== 'resolved');
  const resolvedPositions = positions.filter(p => p.market_status === 'resolved');
  const totalWins = resolvedPositions.filter(p => p.payout > 0).length;
  const winRate = resolvedPositions.length > 0 ? Math.round((totalWins / resolvedPositions.length) * 100) : 0;

  return (
    <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Hero: Portfolio Summary */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Points Balance
            </p>
            <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {user.points_balance} pts
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green-border)',
              padding: '4px 12px', borderRadius: '9999px',
            }}>
              <TrendingUp size={14} color="var(--accent-green)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-green)' }}>
                {accuracy}% accuracy
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {streak} week streak
            </p>
          </div>
        </div>

        {/* Bento Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div style={{
            background: 'var(--bg-card)', padding: '20px',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <Star size={20} color="var(--primary)" />
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Rank</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)', padding: '20px',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <Wallet size={20} color="var(--accent-green)" />
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Available</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.points_balance} pts</p>
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)', padding: '20px',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <History size={20} color="var(--accent-blue)" />
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Total Predictions</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{positions.length}</p>
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)', padding: '20px',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <Trophy size={20} color="var(--accent-yellow)" />
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Win Rate</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{winRate}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Active Positions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activePositions.slice(0, 5).map((pos) => (
              <div key={pos.id} style={{
                background: 'var(--bg-card)', padding: '20px',
                borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: 'var(--primary)',
                      background: 'var(--primary-bg)', padding: '2px 8px', borderRadius: '4px',
                      textTransform: 'uppercase', letterSpacing: '-0.02em',
                    }}>
                      {pos.market_category || 'Market'}
                    </span>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                      {pos.market_title}
                    </h4>
                  </div>
                  <div style={{
                    background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green-border)',
                    padding: '4px 8px', borderRadius: 'var(--radius-lg)', textAlign: 'center', minWidth: '50px',
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-green)', lineHeight: 1 }}>{pos.outcome_label}</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>
                      {Number(pos.shares).toFixed(1)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {Number(pos.shares).toFixed(1)} shares
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trade History */}
      <section>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Trade History
        </h3>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {resolvedPositions.length === 0 && activePositions.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <Target size={24} color="var(--text-tertiary)" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>
                No predictions yet
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                Pick your first market to start building your record.
              </p>
            </div>
          ) : resolvedPositions.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <History size={24} color="var(--text-tertiary)" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                No resolved trades yet. Your history will appear here.
              </p>
            </div>
          ) : (
            <div>
              {resolvedPositions.slice(0, 20).map((pos, i) => {
                const isWin = pos.payout > 0;
                return (
                  <div key={pos.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: i < resolvedPositions.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: isWin ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {isWin
                          ? <ArrowUpRight size={18} color="var(--accent-green)" />
                          : <ArrowDownRight size={18} color="var(--accent-red)" />
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pos.market_title}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Position: {pos.outcome_label}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: isWin ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {isWin ? `+${pos.payout}` : 'Lost'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ThemeToggle />
      <ReferralCard />

      {/* Share Profile */}
      <button
        onClick={() => {
          const text = `${user.name} on IroyinMarket\n${accuracy}% accuracy | ${streak} week streak\n\nPredict & compete: ${window.location.origin}`;
          if (navigator.share) {
            navigator.share({ text });
          } else {
            navigator.clipboard.writeText(text);
          }
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', marginTop: '24px', padding: '14px',
          background: 'var(--primary-bg)', border: '1px solid var(--primary-border)',
          borderRadius: '9999px', color: 'var(--primary)',
          fontSize: '13px', fontWeight: 700,
        }}
      >
        <Share2 size={14} /> Share Profile
      </button>
    </div>
  );
}
