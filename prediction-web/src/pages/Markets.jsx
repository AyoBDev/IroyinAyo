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

function SocialProofBanner({ socialProof }) {
  if (!socialProof) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', width: '100%', maxWidth: '320px' }}>
      {socialProof.activePredictors > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-green-bg, rgba(34,197,94,0.08))',
          border: '1px solid var(--accent-green-border, rgba(34,197,94,0.2))',
        }}>
          <Users size={14} color="var(--accent-green)" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--accent-green)' }}>{socialProof.activePredictors}</strong> predictors active this week
          </span>
        </div>
      )}
      {socialProof.recentWinners.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-yellow-bg, rgba(250,204,21,0.08))',
          border: '1px solid var(--accent-yellow-border, rgba(250,204,21,0.2))',
        }}>
          <Trophy size={14} color="var(--accent-yellow)" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'var(--primary-bg)', border: '2px solid var(--primary-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <TrendingUp size={28} color="var(--primary)" />
      </div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
        {isReturning ? 'Welcome back!' : 'Welcome to IroyinMarket'}
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '300px' }}>
        {isReturning
          ? 'Enter the code sent to your WhatsApp to continue.'
          : 'Predict outcomes on campus events and compete for real cash prizes every week.'}
      </p>

      <SocialProofBanner socialProof={socialProof} />

      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (e.g. 08012345678)"
            required
            autoFocus
            style={{
              width: '100%', padding: '12px 16px', fontSize: '14px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px',
              background: 'var(--primary)', color: '#fff',
              borderRadius: '9999px', fontSize: '14px', fontWeight: 600, border: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><span>Continue</span><ArrowRight size={16} /></>}
          </button>
        </form>
      )}

      {step === 'signup' && (
        <form onSubmit={handleSignupSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            New here? Tell us your name to get started.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoFocus
            style={{
              width: '100%', padding: '12px 16px', fontSize: '14px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="Referral code (optional)"
            style={{
              width: '100%', padding: '12px 16px', fontSize: '14px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px',
              background: 'var(--primary)', color: '#fff',
              borderRadius: '9999px', fontSize: '14px', fontWeight: 600, border: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><span>Continue</span><ArrowRight size={16} /></>}
          </button>
          <button
            type="button"
            onClick={() => { setStep('phone'); setError(''); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', textDecoration: 'underline', marginTop: '4px' }}
          >
            Use a different number
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCodeSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
            style={{
              width: '100%', padding: '12px 16px', fontSize: '20px', fontWeight: 700,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
              textAlign: 'center', letterSpacing: '4px',
            }}
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px',
              background: 'var(--primary)', color: '#fff',
              borderRadius: '9999px', fontSize: '14px', fontWeight: 600, border: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (isReturning ? 'Sign In' : 'Verify & Join')}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); setIsReturning(false); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', textDecoration: 'underline' }}
            >
              Change number
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', textDecoration: 'underline' }}
            >
              Resend code
            </button>
          </div>
          <button
            type="button"
            onClick={handleSkipCode}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600, marginTop: '8px',
            }}
          >
            Didn't get code? Skip verification
          </button>
        </form>
      )}

      {error && (
        <p style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '12px', fontWeight: 600 }}>
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', margin: '0 16px 8px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--accent-green-bg, rgba(34,197,94,0.08))',
      border: '1px solid var(--accent-green-border, rgba(34,197,94,0.15))',
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }} />
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--accent-green)' }}>{count}</strong> predictors active this week
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
      <LivePredictorCount />

      {/* Category Chips */}
      <section className="no-scrollbar" style={{
        display: 'flex', gap: '8px', padding: '16px 16px',
        overflowX: 'auto',
      }}>
        {categories.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'var(--primary)' : 'var(--bg-surface-container)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
                textTransform: 'capitalize',
              }}
            >
              {cat === 'all' ? 'Trending' : cat}
            </button>
          );
        })}
      </section>

      {/* Market Feed */}
      <div
        className="app-layout"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 300px',
          gap: '16px', padding: '0 16px 16px',
          maxWidth: '1400px', margin: '0 auto',
        }}
      >
        <main>
          {activeMarkets.length === 0 && resolvedMarkets.length === 0 ? (
            <div style={{
              padding: '48px 20px', textAlign: 'center',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                No markets in this category yet
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                New markets are added weekly. Check back soon!
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}>
              {activeMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
              {resolvedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </main>

        <aside className="desktop-sidebar" style={{
          position: 'sticky', top: '76px', alignSelf: 'start',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <SharpMoney />
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
          <Leaderboard />
        </aside>
      </div>

      <div className="mobile-only" style={{ padding: '0 16px 80px' }}>
        <SharpMoney />
        <div style={{ marginTop: '12px' }}><HowItWorks /></div>
        <div style={{ marginTop: '12px' }}><PublicChat /></div>
        <div style={{ marginTop: '12px' }}><ActivityFeed /></div>
        <div style={{ marginTop: '12px' }}><Leaderboard /></div>
      </div>

      <CreateMarketFAB onClick={() => setShowCreateForm(true)} />
      {showCreateForm && <CreateMarketForm onClose={() => setShowCreateForm(false)} />}
    </>
  );
}
