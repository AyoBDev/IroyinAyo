import { useState } from 'react';
import { TrendingUp, ArrowRight, Loader2, X } from 'lucide-react';
import { setToken, apiFetch } from '../api.js';

export default function AuthModal({ onClose }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'name'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isReturning, setIsReturning] = useState(false);
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
      if (result.returning) {
        setIsReturning(true);
        setStep('code');
      } else {
        try {
          await apiFetch('/api/auth/send-code', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber: phone.trim() }),
          });
        } catch {
          // OTP send failed — user can still skip
        }
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
    if (isReturning) {
      setLoading(true);
      setError('');
      try {
        const result = await apiFetch('/api/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber: phone.trim(), code: code.trim(), name: '_returning' }),
        });
        setToken(result.token);
        window.location.reload();
      } catch (err) {
        setError(err.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep('name');
  }

  async function handleNameSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !referralCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = code ? '/api/auth/verify' : '/api/auth/quick-join';
      const body = code
        ? { phoneNumber: phone.trim(), code: code.trim(), name: name.trim(), referralCode: referralCode.trim().toUpperCase() }
        : { phoneNumber: phone.trim(), name: name.trim(), referralCode: referralCode.trim().toUpperCase() };
      const result = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setToken(result.token);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)',
          padding: '2rem', maxWidth: '420px', width: '100%', textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '4px',
          }}
        >
          <X size={20} />
        </button>

        <TrendingUp size={40} color="var(--accent-green)" strokeWidth={2.5} style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>IroyinMarket</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '340px', marginBottom: '36px', lineHeight: 1.6, marginLeft: 'auto', marginRight: 'auto' }}>
          Predict campus events, sports, and pop culture. Earn points, climb the leaderboard, win prizes.
        </p>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
          padding: '28px 36px', border: '1px solid var(--border)', textAlign: 'center',
          maxWidth: '360px', width: '100%', marginLeft: 'auto', marginRight: 'auto',
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Different number
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (isReturning) {
                      setLoading(true);
                      setError('');
                      try {
                        const result = await apiFetch('/api/auth/quick-join', {
                          method: 'POST',
                          body: JSON.stringify({ phoneNumber: phone.trim(), name: '_returning' }),
                        });
                        setToken(result.token);
                        window.location.reload();
                      } catch (err) {
                        setError(err.message || 'Could not log in');
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setCode('');
                      setStep('name');
                    }
                  }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--accent-blue)', fontSize: '12px', cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Didn't get code? Skip
                </button>
              </div>
            </form>
          )}

          {step === 'name' && (
            <form onSubmit={handleNameSubmit}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Almost there!
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '16px' }}>
                IroyinMarket is invite-only. Enter your name and the code from whoever invited you.
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
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="Invite code (e.g. AYOB3K9F)"
                maxLength={12}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '12px',
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center',
                  outline: 'none', marginBottom: '12px', textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}
              />
              {error && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !name.trim() || !referralCode.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700,
                  background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                  width: '100%', opacity: loading || !name.trim() || !referralCode.trim() ? 0.6 : 1,
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
    </div>
  );
}
