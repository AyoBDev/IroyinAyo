import { useState } from 'react';
import { TrendingUp, ArrowRight, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { apiFetch, ApiError } from '../api.js';
import { markEligible } from '../lib/installPrompt.js';
import useStore from '../store.js';

function defaultStep(needsBootstrap) {
  if (typeof window !== 'undefined' && window.sessionStorage?.getItem('forgotPin') === '1') {
    return 'set-pin';
  }
  return needsBootstrap ? 'signup-details' : 'email';
}

export default function AuthModal({ onClose, initialStep, dismissable = true }) {
  const needsBootstrap = useStore((s) => s.needsBootstrap);
  const [step, setStep] = useState(initialStep || defaultStep(needsBootstrap));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw new Error(error.message);
      setStep('code');
    } catch (err) {
      setError(err.message || 'Could not send code');
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
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      });
      if (error) throw new Error(error.message);

      // If user came from "Forgot PIN", route to set-pin regardless of has_pin.
      if (sessionStorage.getItem('forgotPin') === '1') {
        sessionStorage.removeItem('forgotPin');
        setStep('set-pin');
        return;
      }

      try {
        const info = await apiFetch('/api/multi-markets/me/info');
        if (info && info.has_pin) {
          setStep('pin');
          return;
        }
        setStep('set-pin');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'BOOTSTRAP_REQUIRED') {
          setStep('signup-details');
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupDetailsSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (!/^\d{6}$/.test(pin)) { setError('PIN must be 6 digits'); return; }
    if (pin !== pinConfirm) { setError('PINs do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phone.trim(),
          pin,
          referralCode: referralCode.trim().toUpperCase() || undefined,
        }),
      });
      sessionStorage.setItem('pinUnlocked', '1');
      markEligible();
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not complete signup');
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      sessionStorage.setItem('pinUnlocked', '1');
      window.location.reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PIN_LOCKED') {
        await supabase.auth.signOut();
        window.location.reload();
        return;
      }
      if (err instanceof ApiError && err.code === 'PIN_INVALID') {
        const remaining = err.attemptsRemaining ?? '';
        setError(remaining !== '' ? `Wrong PIN. ${remaining} attempts left.` : 'Wrong PIN');
        return;
      }
      setError(err.message || 'Could not verify PIN');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPinSubmit(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) { setError('PIN must be 6 digits'); return; }
    if (pin !== pinConfirm) { setError('PINs do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/set-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      sessionStorage.setItem('pinUnlocked', '1');
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save PIN');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPin() {
    sessionStorage.setItem('forgotPin', '1');
    await supabase.auth.signOut();
    window.location.reload();
  }

  function handleGoogle() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <div
      onClick={dismissable ? onClose : undefined}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bone rounded-2xl p-8 max-w-[420px] w-full text-center relative shadow-float-lg"
      >
        {dismissable && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}

        <TrendingUp size={40} className="text-accent-green mb-5" strokeWidth={2.5} />
        <h1 className="font-serif text-2xl text-ink mb-2 tracking-tight">IroyinMarket</h1>
        <p className="text-ink-muted text-sm max-w-[340px] mb-9 leading-relaxed mx-auto">
          Predict campus events, sports, and pop culture. Earn points, climb the leaderboard, win prizes.
        </p>

        <div className="bg-paper rounded-2xl py-7 px-9 border border-line text-center max-w-[360px] w-full mx-auto">
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-4">Sign in with email</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 placeholder:text-ink-muted"
              />
              {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading || !email.trim() ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue
                {!loading && <ArrowRight size={14} />}
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-line flex-1" />
                <span className="text-ink-muted text-xs">or</span>
                <div className="h-px bg-line flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-semibold border border-line bg-bone text-ink w-full"
              >
                Continue with Google
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleCodeSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-2">Enter verification code</p>
              <p className="text-ink-muted text-[11px] mb-4">Check your email for a 6-digit code</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full py-3.5 px-4 rounded-xl border border-line bg-bone text-ink text-2xl text-center tracking-[8px] outline-none mb-3 font-bold placeholder:text-ink-muted"
              />
              {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading || code.length !== 6 ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Next
                {!loading && <ArrowRight size={14} />}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="text-ink-muted text-xs underline mt-3"
              >
                Different email
              </button>
            </form>
          )}

          {step === 'signup-details' && (
            <form onSubmit={handleSignupDetailsSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-2">Almost there!</p>
              <p className="text-ink-muted text-[11px] mb-4">Set up your account.</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={30}
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 placeholder:text-ink-muted"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (e.g. 08012345678)"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 placeholder:text-ink-muted"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Create 6-digit PIN"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 tracking-widest placeholder:text-ink-muted placeholder:tracking-normal"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Confirm PIN"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 tracking-widest placeholder:text-ink-muted placeholder:tracking-normal"
              />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="Invite code (optional)"
                maxLength={12}
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 uppercase tracking-widest placeholder:text-ink-muted placeholder:normal-case placeholder:tracking-normal"
              />
              {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || !name.trim() || !phone.trim() || pin.length !== 6 || pinConfirm.length !== 6}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Start Predicting
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-4">Enter your PIN to unlock</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full py-3.5 px-4 rounded-xl border border-line bg-bone text-ink text-2xl text-center tracking-[8px] outline-none mb-3 font-bold placeholder:text-ink-muted"
              />
              {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || pin.length !== 6}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading || pin.length !== 6 ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Unlock
              </button>
              <button
                type="button"
                onClick={handleForgotPin}
                className="text-ink-muted text-xs underline mt-3"
              >
                Forgot PIN?
              </button>
            </form>
          )}

          {step === 'set-pin' && (
            <form onSubmit={handleSetPinSubmit}>
              <p className="text-ink-muted text-[13px] font-semibold mb-2">Create your PIN</p>
              <p className="text-ink-muted text-[11px] mb-4">A 6-digit PIN to unlock the app.</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="New 6-digit PIN"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 tracking-widest placeholder:text-ink-muted placeholder:tracking-normal"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Confirm PIN"
                className="w-full py-3 px-4 rounded-xl border border-line bg-bone text-ink text-base text-center outline-none mb-3 tracking-widest placeholder:text-ink-muted placeholder:tracking-normal"
              />
              {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || pin.length !== 6 || pinConfirm.length !== 6}
                className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
                  loading ? 'opacity-60' : 'hover:bg-emerald-deep'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Save PIN
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
