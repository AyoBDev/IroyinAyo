import { useState } from 'react';
import { TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { setToken, apiFetch } from '../api.js';

export default function NoAuth() {
  const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'name'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      if (result.token) {
        setToken(result.token);
        window.location.reload();
      } else {
        // New user — send OTP
        await apiFetch('/api/auth/send-code', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber: phone.trim() }),
        });
        setStep('code');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) return;
    setStep('name');
  }

  async function handleNameSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone.trim(), code: code.trim(), name: name.trim() }),
      });
      setToken(result.token);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Verification failed');
      setStep('code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center',
    }}>
      <TrendingUp size={40} color="var(--accent-green)" strokeWidth={2.5} style={{ marginBottom: '20px' }} />
      <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>IroyinMarket</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '340px', marginBottom: '36px', lineHeight: 1.6 }}>
        Predict hackathon winners and football outcomes. Play with points, compete with friends.
      </p>

      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
        padding: '28px 36px', border: '1px solid var(--border)', textAlign: 'center',
        maxWidth: '360px', width: '100%',
      }}>
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
              Enter your phone number to get started
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08012345678"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center',
                outline: 'none', marginBottom: '12px',
              }}
            />
            <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '16px' }}>
              Returning users log in instantly. New users get a WhatsApp code.
            </p>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700,
                background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                width: '100%', opacity: loading || !phone.trim() ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Continue
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Enter verification code
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '16px' }}>
              Check your WhatsApp for a 6-digit code
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="000000"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: '24px', textAlign: 'center',
                letterSpacing: '8px', outline: 'none', marginBottom: '12px',
                fontWeight: 700,
              }}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={code.length !== 6}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700,
                background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                width: '100%', opacity: code.length !== 6 ? 0.6 : 1,
              }}
            >
              Next
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              style={{
                marginTop: '12px', background: 'none', border: 'none',
                color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Use a different number
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              What should we call you?
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '16px' }}>
              This name shows on the leaderboard
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={30}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center',
                outline: 'none', marginBottom: '12px',
              }}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700,
                background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                width: '100%', opacity: loading || !name.trim() ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Start Predicting
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
