import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share, X } from 'lucide-react';
import {
  isStandalone,
  isIOSSafari,
  getDismissedAt,
  setDismissedAt,
  isSnoozed,
  isEligible,
} from '../lib/installPrompt.js';
import { capture } from '../lib/posthogClient.js';

export default function InstallBanner() {
  const [eligible] = useState(() => isEligible());
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const standalone = isStandalone();
  const iOSSafari = isIOSSafari(navigator.userAgent, standalone);

  useEffect(() => {
    if (standalone) return undefined;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installedHandler = () => {
      capture('app_installed');
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [standalone]);

  useEffect(() => {
    if (eligible && !standalone && (deferredPrompt || iOSSafari)) {
      capture('install_banner_shown', { platform: iOSSafari ? 'ios_safari' : 'promptable' });
    }
  }, [eligible, standalone, deferredPrompt, iOSSafari]);

  if (standalone) return null;
  if (!eligible) return null;
  if (dismissed) return null;
  if (isSnoozed(Date.now(), getDismissedAt())) return null;
  if (!iOSSafari && !deferredPrompt) return null;

  const onDismiss = () => {
    setDismissedAt(Date.now());
    setDismissed(true);
    capture('install_banner_dismissed', { platform: iOSSafari ? 'ios_safari' : 'promptable' });
  };

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      capture(outcome === 'accepted' ? 'install_prompt_accepted' : 'install_prompt_dismissed');
    } catch (err) {
      capture('install_prompt_error', { message: String(err && err.message) });
    } finally {
      setDeferredPrompt(null);
    }
  };

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 max-w-md px-4">
      <div className="rounded-2xl bg-paper text-ink shadow-float-lg border border-line p-4">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" width="48" height="48" className="rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="font-serif text-section leading-tight">Install IroyinMarket</p>
            {iOSSafari ? (
              <p className="font-sans text-body mt-1">
                Tap <Share aria-label="Share" className="inline w-4 h-4 align-text-bottom" /> then <span className="font-semibold">Add to Home Screen</span>.
              </p>
            ) : (
              <p className="font-sans text-body mt-1">Get one-tap access from your home screen.</p>
            )}
            <div className="mt-3 flex gap-2">
              {iOSSafari ? (
                <button onClick={onDismiss} className="rounded-lg bg-emerald text-bone px-4 py-2 font-sans text-sm">
                  Got it
                </button>
              ) : (
                <>
                  <button onClick={onInstall} className="rounded-lg bg-emerald text-bone px-4 py-2 font-sans text-sm">
                    Install
                  </button>
                  <button onClick={onDismiss} className="rounded-lg border border-line px-4 py-2 font-sans text-sm">
                    Not now
                  </button>
                </>
              )}
            </div>
          </div>
          <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
