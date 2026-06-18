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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bone rounded-2xl p-8 max-w-[420px] w-full text-center relative shadow-float-lg"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted p-1"
        >
          <X size={20} />
        </button>

        <TrendingUp size={40} className="text-accent-green mb-5" strokeWidth={2.5} />
        <h1 className="font-serif text-2xl text-ink mb-2 tracking-tight">IroyinMarket</h1>
        <p className="text-ink-muted text-sm max-w-[340px] mb-9 leading-relaxed mx-auto">
          Predict campus events, sports, and pop culture. Earn points, climb the leaderboard, win prizes.
        </p>

        <div className="bg-paper rounded-2xl py-7 px-9 border border-line text-center max-w-[360px] w-full mx-auto">
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-4">
                Enter your phone number to get started
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08012345678"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 placeholder:text-ink-muted"
              />
              <p className="text-ink-muted text-[11px] mb-4">
                Returning users log in instantly. New users get a WhatsApp code.
              </p>
              {error && (
                <p className="text-accent-red text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading || !phone.trim() ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleCodeSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-2">
                Enter verification code
              </p>
              <p className="text-ink-muted text-[11px] mb-4">
                Check your WhatsApp for a 6-digit code
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full py-3.5 px-4 rounded-xl border border-line bg-bone text-ink text-2xl text-center tracking-[8px] outline-none mb-3 font-bold placeholder:text-ink-muted"
              />
              {error && (
                <p className="text-accent-red text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={code.length !== 6}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  code.length !== 6 ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                Next
                <ArrowRight size={14} />
              </button>
              <div className="flex justify-between mt-3">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  className="text-ink-muted text-xs underline"
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
                        await apiFetch('/api/auth/send-code', {
                          method: 'POST',
                          body: JSON.stringify({ phoneNumber: phone.trim() }),
                        });
                        setError('');
                        alert('A new code has been sent to your WhatsApp.');
                      } catch (err) {
                        setError(err.message || 'Could not resend code');
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setCode('');
                      setStep('name');
                    }
                  }}
                  className="text-emerald text-xs font-semibold"
                >
                  {isReturning ? 'Resend code' : "Didn't get code? Skip"}
                </button>
              </div>
            </form>
          )}

          {step === 'name' && (
            <form onSubmit={handleNameSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-2">
                Almost there!
              </p>
              <p className="text-ink-muted text-[11px] mb-4">
                IroyinMarket is invite-only. Enter your name and the code from whoever invited you.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={30}
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 placeholder:text-ink-muted"
              />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="Invite code (e.g. AYOB3K9F)"
                maxLength={12}
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 uppercase tracking-widest placeholder:text-ink-muted placeholder:normal-case placeholder:tracking-normal"
              />
              {error && (
                <p className="text-accent-red text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !name.trim() || !referralCode.trim()}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading || !name.trim() || !referralCode.trim() ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
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
