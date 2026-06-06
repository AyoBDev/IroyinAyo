import { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight, Loader2, Users, Trophy } from 'lucide-react';
import { getToken, setToken, apiFetch } from '../api.js';
import useStore from '../store.js';
import MarketCard from '../components/MarketCard.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import PublicChat from '../components/PublicChat.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import SharpMoney from '../components/SharpMoney.jsx';
import CreateMarketFAB from '../components/CreateMarketFAB.jsx';
import CreateMarketForm from '../components/CreateMarketForm.jsx';
import Tutorial from '../components/Tutorial.jsx';

function SocialProofBanner({ socialProof }) {
  if (!socialProof) return null;
  return (
    <div className="flex flex-col gap-2 mb-5 w-full max-w-[320px]">
      {socialProof.activePredictors > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-green-bg border border-accent-green-border">
          <Users size={14} className="text-accent-green" />
          <span className="text-xs text-ink-muted">
            <strong className="text-accent-green">{socialProof.activePredictors}</strong> predictors active this week
          </span>
        </div>
      )}
      {socialProof.recentWinners.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-yellow-bg border border-accent-yellow-border">
          <Trophy size={14} className="text-accent-yellow" />
          <span className="text-xs text-ink-muted">
            <strong>{socialProof.recentWinners[0].name}</strong> won +{socialProof.recentWinners[0].payout} pts
          </span>
        </div>
      )}
    </div>
  );
}

function AuthWall() {
  const [step, setStep] = useState('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [socialProof, setSocialProof] = useState(null);

  useEffect(() => {
    apiFetch('/api/multi-markets/social-proof').then(setSocialProof).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferralCode(ref);
  }, []);

  function isValidNigerianPhone(num) {
    const cleaned = num.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return ['7', '8', '9'].includes(cleaned[1]);
    }
    if (cleaned.startsWith('234') && cleaned.length === 13) {
      return ['7', '8', '9'].includes(cleaned[3]);
    }
    return false;
  }

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!isValidNigerianPhone(phone.trim())) {
      setError('Please enter a valid Nigerian phone number (e.g. 08012345678)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      if (result.returning) {
        setIsReturning(true);
        setStep('code');
      } else {
        setIsReturning(false);
        setStep('signup');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      setStep('code');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          code,
          name: isReturning ? '_returning' : name.trim(),
          referralCode: !isReturning && referralCode ? referralCode.trim() : undefined,
        }),
      });
      if (result.token) {
        setToken(result.token);
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipCode() {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/quick-join', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          name: isReturning ? '_returning' : name.trim(),
          referralCode: !isReturning && referralCode ? referralCode.trim() : undefined,
        }),
      });
      if (result.token) {
        setToken(result.token);
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError('');
    try {
      await apiFetch('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
    } catch {}
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-accent-green-bg border-2 border-accent-green-border flex items-center justify-center mb-5">
        <TrendingUp size={28} className="text-emerald" />
      </div>
      <h2 className="font-serif text-section mb-2 text-ink">
        {isReturning ? 'Welcome back!' : 'Welcome to IroyinMarket'}
      </h2>
      <p className="text-body-sm text-ink-muted mb-6 max-w-[300px]">
        {isReturning
          ? 'Enter the code sent to your WhatsApp to continue.'
          : 'Predict outcomes on campus events and compete for real cash prizes every week.'}
      </p>

      <SocialProofBanner socialProof={socialProof} />

      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="w-full max-w-[320px] flex flex-col gap-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (e.g. 08012345678)"
            required
            autoFocus
            className="w-full px-4 py-3 text-body-sm bg-bone border border-line rounded-lg text-ink placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald text-bone rounded-xl text-body-sm font-medium disabled:opacity-60 hover:bg-emerald-deep transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={16} /></>}
          </button>
        </form>
      )}

      {step === 'signup' && (
        <form onSubmit={handleSignupSubmit} className="w-full max-w-[320px] flex flex-col gap-3">
          <p className="text-xs text-ink-muted mb-1">
            New here? Tell us your name to get started.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoFocus
            className="w-full px-4 py-3 text-body-sm bg-bone border border-line rounded-lg text-ink placeholder:text-ink-muted"
          />
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="Referral code (optional)"
            className="w-full px-4 py-3 text-body-sm bg-bone border border-line rounded-lg text-ink placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald text-bone rounded-xl text-body-sm font-medium disabled:opacity-60 hover:bg-emerald-deep transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={16} /></>}
          </button>
          <button
            type="button"
            onClick={() => { setStep('phone'); setError(''); }}
            className="bg-transparent border-none text-ink-muted text-xs underline mt-1"
          >
            Use a different number
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCodeSubmit} className="w-full max-w-[320px] flex flex-col gap-3">
          <p className="text-xs text-ink-muted mb-1">
            Enter the 6-digit code sent to {phone}
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="w-full px-4 py-3 text-xl font-bold bg-bone border border-line rounded-lg text-ink text-center tracking-[4px] placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald text-bone rounded-xl text-body-sm font-medium disabled:opacity-60 hover:bg-emerald-deep transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : (isReturning ? 'Sign In' : 'Verify & Join')}
          </button>
          <div className="flex justify-between mt-1">
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); setIsReturning(false); }}
              className="bg-transparent border-none text-ink-muted text-xs underline"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              className="bg-transparent border-none text-ink-muted text-xs underline"
            >
              Resend code
            </button>
          </div>
          <button
            type="button"
            onClick={handleSkipCode}
            className="bg-transparent border-none text-emerald text-xs font-semibold mt-2"
          >
            Didn't get code? Skip verification
          </button>
        </form>
      )}

      {error && (
        <p className="text-accent-red text-xs mt-3 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

function LivePredictorCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    apiFetch('/api/multi-markets/social-proof')
      .then(data => setCount(data.activePredictors))
      .catch(() => {});
  }, []);

  if (!count || count < 3) return null;

  return (
    <div data-tutorial="incentives" className="flex items-center gap-2 px-3 py-2 mx-4 mt-3 mb-2 rounded-lg bg-accent-green-bg border border-accent-green-border">
      <div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--accent-green)]" />
      <span className="text-xs text-ink-muted">
        <strong className="text-accent-green">{count}</strong> predictors active this week
      </span>
    </div>
  );
}

export default function Markets() {
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { markets } = useStore();

  if (!getToken()) {
    return <AuthWall />;
  }

  const categories = ['all', ...new Set(markets.map((m) => m.category).filter(Boolean))];

  const filteredMarkets = activeTab === 'all'
    ? markets
    : markets.filter((m) => m.category === activeTab);

  const activeMarkets = filteredMarkets.filter((m) => m.status !== 'resolved');
  const resolvedMarkets = filteredMarkets.filter((m) => m.status === 'resolved');

  return (
    <>
      <Tutorial />
      <LivePredictorCount />

      {/* Category Chips */}
      <section className="no-scrollbar flex gap-2 px-4 py-4 overflow-x-auto">
        {categories.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-5 py-2 text-xs font-semibold whitespace-nowrap rounded-full capitalize transition-colors ${
                isActive
                  ? 'bg-emerald text-bone'
                  : 'bg-paper text-ink-muted border border-line hover:bg-paper-hover'
              }`}
            >
              {cat === 'all' ? 'Trending' : cat}
            </button>
          );
        })}
      </section>

      {/* Market Feed */}
      <div className="app-layout grid grid-cols-[1fr_300px] gap-4 px-4 pb-4 max-w-[1400px] mx-auto">
        <main>
          {activeMarkets.length === 0 && resolvedMarkets.length === 0 ? (
            <div className="px-5 py-12 text-center bg-paper rounded-2xl border border-line">
              <p className="text-body-sm text-ink-muted mb-2">
                No markets in this category yet
              </p>
              <p className="text-xs text-ink-muted opacity-70">
                New markets are added weekly. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {activeMarkets.map((market, index) => (
                <MarketCard key={market.id} market={market} dataTutorial={index === 0 ? 'market-card' : undefined} />
              ))}
              {resolvedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </main>

        <aside className="desktop-sidebar sticky top-[76px] self-start flex flex-col gap-3">
          <SharpMoney />
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
          <Leaderboard />
        </aside>
      </div>

      <div className="mobile-only px-4 pb-20">
        <SharpMoney />
        <div className="mt-3"><HowItWorks /></div>
        <div className="mt-3"><PublicChat /></div>
        <div className="mt-3"><ActivityFeed /></div>
        <div className="mt-3"><Leaderboard /></div>
      </div>

      <CreateMarketFAB onClick={() => setShowCreateForm(true)} />
      {showCreateForm && <CreateMarketForm onClose={() => setShowCreateForm(false)} />}
    </>
  );
}
