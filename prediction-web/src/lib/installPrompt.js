export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'installBannerDismissedAt';
const ELIGIBLE_KEY = 'installPromptEligible';

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

export function isIOSSafari(userAgent, standalone) {
  if (standalone) return false;
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  if (!isIOS) return false;
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  if (isOtherIOSBrowser) return false;
  return /Safari/.test(userAgent);
}

export function getDismissedAt() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setDismissedAt(now) {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // localStorage unavailable (private mode) — accept transient state
  }
}

export function isSnoozed(now, dismissedAt) {
  if (dismissedAt === null) return false;
  return now - dismissedAt < SNOOZE_MS;
}

export function markEligible() {
  try {
    localStorage.setItem(ELIGIBLE_KEY, '1');
  } catch {
    // localStorage unavailable — silent no-op
  }
}

export function isEligible() {
  try {
    return localStorage.getItem(ELIGIBLE_KEY) === '1';
  } catch {
    return false;
  }
}
