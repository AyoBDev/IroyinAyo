import { useState, useEffect } from 'react';
import { TrendingUp, Target, Flame, Award, ArrowUpRight, ArrowDownRight, Share2, Copy, Check, Gift, Sun, Moon, Wallet, Star, History, Trophy, MessageCircle } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import { getTheme, toggleTheme } from '../theme.js';
import ProfileShareModal from '../components/ProfileShareModal.jsx';
import ProfileAccuracyHeader from '../components/ProfileAccuracyHeader.jsx';
import { supabase } from '../lib/supabase.js';

function MyMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/multi-markets/me/created')
      .then(setMarkets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (markets.length === 0) return null;

  return (
    <div className="bg-paper rounded-2xl border border-line p-4 mt-3">
      <h3 className="text-sm font-bold text-ink mb-3">
        My Markets
      </h3>
      <div className="flex flex-col gap-2.5">
        {markets.map((m) => {
          const fee = m.status === 'resolved' ? Math.floor(m.total_volume * 0.05) : null;
          return (
            <a
              key={m.id}
              href={`/market/${m.id}`}
              className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-paper border border-line no-underline"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                  {m.title}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  Vol: {m.total_volume} pts
                  {fee !== null && <span className="text-accent-green ml-2">+{fee} earned</span>}
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.status === 'resolved' ? 'bg-accent-green-bg text-accent-green border-accent-green/30' : 'bg-accent-green-bg text-emerald border-emerald/30'}`}>
                {m.status === 'resolved' ? 'Resolved' : 'Open'}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="bg-paper rounded-2xl border border-line overflow-hidden mt-6">
      <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
        <Gift size={14} className="text-accent-violet" />
        <h3 className="text-[13px] font-bold uppercase tracking-wide">
          Refer Friends
        </h3>
      </div>

      <div className="p-5">
        <p className="text-xs text-ink-muted mb-3">
          You both get <span className="text-accent-green font-bold">50 pts</span> when a friend joins with your code.
        </p>

        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-bone rounded-lg border border-line mb-2.5">
          <span className="flex-1 text-[15px] font-bold tracking-wider font-mono">
            {stats.code}
          </span>
          <button onClick={handleCopy} className="px-2.5 py-1.5 bg-paper border border-line rounded-md text-ink-muted flex items-center gap-1 text-[11px] font-semibold">
            {copied ? <><Check size={12} className="text-accent-green" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>

        <button onClick={handleShare} className="flex items-center justify-center gap-2 w-full py-3 mb-3.5 bg-accent-violet-bg border border-accent-violet/30 rounded-full text-accent-violet text-xs font-bold">
          <Share2 size={13} /> Share Referral Link
        </button>

        <div className="flex gap-3 mb-3.5">
          <div className="flex-1 p-2.5 bg-bone rounded-md text-center">
            <div className="font-mono text-base font-bold text-ink">{stats.referralCount}</div>
            <div className="text-[10px] text-ink-muted mt-0.5">Referred</div>
          </div>
          <div className="flex-1 p-2.5 bg-bone rounded-md text-center">
            <div className="font-mono text-base font-bold text-accent-green">+{stats.totalEarned}</div>
            <div className="text-[10px] text-ink-muted mt-0.5">Pts Earned</div>
          </div>
        </div>

        <div className="border-t border-line pt-3.5">
          <div className="text-[11px] text-ink-muted mb-2 font-medium">Have a referral code?</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={8}
              className="flex-1 px-3 py-2.5 text-[13px] font-semibold bg-bone border border-line rounded-md text-ink tracking-wider font-mono"
            />
            <button
              onClick={handleApply}
              disabled={applying || !codeInput.trim()}
              className={`px-4 py-2.5 text-xs font-bold rounded-md border-none ${codeInput.trim() ? 'bg-accent-green text-white' : 'bg-paper text-ink-muted'} ${applying ? 'opacity-60' : ''}`}
            >
              Apply
            </button>
          </div>
          {message && (
            <div className={`mt-2 text-xs font-semibold ${message.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}>
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
    <div className="flex items-center justify-between bg-paper rounded-2xl px-5 py-4 border border-line mt-6">
      <div className="flex items-center gap-2.5">
        {theme === 'dark' ? <Moon size={18} className="text-ink-muted" /> : <Sun size={18} className="text-accent-yellow" />}
        <span className="text-sm font-semibold text-ink">
          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </span>
      </div>
      <button
        onClick={handleToggle}
        className={`relative w-11 h-6 rounded-xl border-none transition-colors duration-200 ${theme === 'dark' ? 'bg-accent-green' : 'bg-line'}`}
        aria-label="Toggle theme"
      >
        <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-[left] duration-200 ${theme === 'dark' ? 'left-[23px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}

export default function Profile() {
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);

  if (!user) {
    return (
      <div className="py-[60px] px-6 text-center">
        <p className="text-ink-muted text-sm mb-4">
          Sign in to view your portfolio
        </p>
        <button
          onClick={openAuthModal}
          className="bg-emerald text-white px-6 py-2.5 rounded-full text-sm font-semibold border-none"
        >
          Join IroyinMarket
        </button>
        <div className="max-w-[400px] mx-auto mt-6">
          <ThemeToggle />
        </div>
      </div>
    );
  }

  const positions = useStore((s) => s.positions);

  if (!user) {
    return (
      <div className="py-10 px-4 text-center">
        <p className="text-ink-muted">Loading profile...</p>
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
    <div className="p-4 max-w-[700px] mx-auto pb-[100px]">
      {/* Profile Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-accent-green-bg border-2 border-emerald/30 flex items-center justify-center shrink-0">
          <span className="text-xl font-extrabold text-emerald">
            {user.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold text-ink leading-tight">
              {user.name}
            </h1>
            {user.is_ambassador && (
              <span className="text-accent-violet bg-accent-violet-bg rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-accent-violet/30">Ambassador</span>
            )}
          </div>
          {user.referred_by_name && (
            <p className="text-[11px] text-ink-muted mt-0.5">
              Invited by <span className="font-semibold text-ink-muted">{user.referred_by_name}</span>
            </p>
          )}
          {user.referral_count > 0 && (
            <p className="text-[11px] text-accent-green mt-0.5 font-semibold">
              {user.referral_count} friend{user.referral_count !== 1 ? 's' : ''} invited
              {!user.is_ambassador && user.referral_count < 10 && (
                <span className="text-ink-muted font-normal"> ({10 - user.referral_count} more to become Ambassador)</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Accuracy */}
      <ProfileAccuracyHeader userId={user.id} />

      {/* Hero: Portfolio Summary */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">
              Points Balance
            </p>
            <h2 className="font-mono text-mono-data font-bold tracking-tight text-ink">
              {user.points_balance} pts
            </h2>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 bg-accent-green-bg border border-accent-green/30 px-3 py-1 rounded-full">
              <TrendingUp size={14} className="text-accent-green" />
              <span className="text-xs font-semibold text-accent-green">
                {accuracy}% accuracy
              </span>
            </div>
            <p className="text-[11px] text-ink-muted mt-1">
              {streak} week streak
            </p>
          </div>
        </div>

        {/* Bento Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-paper p-5 rounded-2xl border border-line flex flex-col gap-2">
            <Star size={20} className="text-emerald" />
            <div>
              <p className="text-[11px] text-ink-muted mb-0.5">Rank</p>
              <p className="font-serif text-lg font-semibold text-ink">{title}</p>
            </div>
          </div>
          <div className="bg-paper p-5 rounded-2xl border border-line flex flex-col gap-2">
            <Wallet size={20} className="text-accent-green" />
            <div>
              <p className="text-[11px] text-ink-muted mb-0.5">Available</p>
              <p className="font-mono text-lg font-semibold text-ink">{user.points_balance} pts</p>
            </div>
          </div>
          <div className="bg-paper p-5 rounded-2xl border border-line flex flex-col gap-2">
            <History size={20} className="text-emerald" />
            <div>
              <p className="text-[11px] text-ink-muted mb-0.5">Total Predictions</p>
              <p className="font-mono text-lg font-semibold text-ink">{positions.length}</p>
            </div>
          </div>
          <div className="bg-paper p-5 rounded-2xl border border-line flex flex-col gap-2">
            <Trophy size={20} className="text-accent-yellow" />
            <div>
              <p className="text-[11px] text-ink-muted mb-0.5">Win Rate</p>
              <p className="font-mono text-lg font-semibold text-ink">{winRate}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <section className="mb-6">
          <h3 className="font-serif text-section font-semibold text-ink mb-3">
            Active Positions
          </h3>
          <div className="flex flex-col gap-3">
            {activePositions.slice(0, 5).map((pos) => (
              <div key={pos.id} className="bg-paper p-5 rounded-2xl border border-line">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-3">
                    <span className="text-[11px] font-semibold text-emerald bg-accent-green-bg px-2 py-0.5 rounded uppercase tracking-tight">
                      {pos.market_category || 'Market'}
                    </span>
                    <h4 className="text-sm font-semibold mt-2 text-ink leading-tight">
                      {pos.market_title}
                    </h4>
                  </div>
                  <div className="bg-accent-green-bg border border-accent-green/30 px-2 py-1 rounded-lg text-center min-w-[50px]">
                    <p className="text-[11px] font-semibold text-accent-green leading-none">{pos.outcome_label}</p>
                    <p className="font-mono text-base font-bold text-accent-green">
                      {Number(pos.shares).toFixed(1)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-ink-muted">
                    {Number(pos.shares).toFixed(1)} shares
                  </span>
                  <span className="text-[13px] font-semibold text-ink-muted">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Markets */}
      <MyMarkets />

      {/* Trade History */}
      <section className="mt-6">
        <h3 className="font-serif text-section font-semibold text-ink mb-3">
          Trade History
        </h3>
        <div className="bg-paper rounded-2xl border border-line overflow-hidden">
          {resolvedPositions.length === 0 && activePositions.length === 0 ? (
            <div className="py-8 px-5 text-center">
              <Target size={24} className="text-ink-muted mx-auto mb-2.5" />
              <p className="text-ink-muted text-sm mb-1.5">
                No predictions yet
              </p>
              <p className="text-ink-muted text-xs">
                Pick your first market to start building your record.
              </p>
            </div>
          ) : resolvedPositions.length === 0 ? (
            <div className="py-8 px-5 text-center">
              <History size={24} className="text-ink-muted mx-auto mb-2.5" />
              <p className="text-ink-muted text-sm">
                No resolved trades yet. Your history will appear here.
              </p>
            </div>
          ) : (
            <div>
              {resolvedPositions.slice(0, 20).map((pos, i) => {
                const isWin = pos.payout > 0;
                return (
                  <div key={pos.id} className={`flex items-center justify-between px-5 py-4 ${i < resolvedPositions.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isWin ? 'bg-accent-green-bg' : 'bg-accent-red-bg'}`}>
                        {isWin
                          ? <ArrowUpRight size={18} className="text-accent-green" />
                          : <ArrowDownRight size={18} className="text-accent-red" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                          {pos.market_title}
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          Position: {pos.outcome_label}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-mono text-sm font-bold ${isWin ? 'text-accent-green' : 'text-accent-red'}`}>
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

      {/* WhatsApp Community */}
      <a
        href="https://chat.whatsapp.com/KAXumZJDd0b340F4OLvwvn?s=cl&p=i&ilr=2"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full mt-6 px-5 py-4 bg-accent-green-bg border border-accent-green/30 rounded-2xl no-underline"
      >
        <MessageCircle size={20} className="text-accent-green shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-ink block">Join our WhatsApp community</span>
          <span className="text-[11px] text-ink-muted">Get tips, updates & chat with other predictors</span>
        </div>
      </a>

      <ReferralCard />

      {/* Share Profile */}
      <ShareProfileButton user={user} accuracy={accuracy} streak={streak} winRate={winRate} totalPredictions={positions.length} />

      {/* Sign Out */}
      <SignOutSection />
    </div>
  );
}

function SignOutSection() {
  const user = useStore((s) => s.user);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error('Sign out error:', err);
      setSigningOut(false);
    }
  };

  return (
    <div className="bg-paper rounded-2xl border border-line p-4 mt-6">
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full py-3 rounded-xl border border-line text-accent-red text-sm font-semibold bg-transparent disabled:opacity-60"
      >
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}

function ShareProfileButton({ user, accuracy, streak, winRate, totalPredictions }) {
  const [showModal, setShowModal] = useState(false);
  const [referralCode, setReferralCode] = useState(null);

  useEffect(() => {
    apiFetch('/api/referrals/me')
      .then((data) => setReferralCode(data?.code || null))
      .catch(() => {});
  }, []);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center justify-center gap-2 w-full mt-6 py-3.5 bg-accent-green-bg border border-emerald/30 rounded-full text-emerald text-[13px] font-bold"
      >
        <Share2 size={14} /> Share Profile
      </button>
      {showModal && (
        <ProfileShareModal
          data={{
            name: user.name,
            title: user.title || 'Newcomer',
            accuracy,
            streak,
            totalPredictions,
            winRate,
            pointsBalance: user.points_balance,
            referralCode,
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
