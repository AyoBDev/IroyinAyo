import { useState } from 'react';
import { TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { getToken, setToken, apiFetch } from '../api.js';
import useStore from '../store.js';
import MarketCard from '../components/MarketCard.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import PublicChat from '../components/PublicChat.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import SharpMoney from '../components/SharpMoney.jsx';

function AuthWall() {
  const [step, setStep] = useState('info');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  async function handleSubmitInfo(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim(), name: name.trim() }),
      });
      setIsReturning(!!result.returning);
      try {
        await apiFetch('/api/auth/send-code', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber: phone.trim() }),
        });
      } catch {}
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
      const result = await apiFetch('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          code,
          ...(isReturning ? {} : { name: name.trim() }),
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
        Welcome to IroyinMarket
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '300px' }}>
        Predict outcomes on campus events and compete for real cash prizes every week.
      </p>

      {step === 'info' && (
        <form onSubmit={handleSubmitInfo} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            style={{
              width: '100%', padding: '12px 16px', fontSize: '14px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (e.g. 08012345678)"
            required
            style={{
              width: '100%', padding: '12px 16px', fontSize: '14px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
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
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Verify & Join'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('info'); setCode(''); setError(''); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '4px' }}
          >
            Change number
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

export default function Markets() {
  const [activeTab, setActiveTab] = useState('all');
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
    </>
  );
}
