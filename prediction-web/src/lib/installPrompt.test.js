import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SNOOZE_MS,
  isIOSSafari,
  getDismissedAt,
  setDismissedAt,
  isSnoozed,
  isStandalone,
  markEligible,
  isEligible,
} from './installPrompt.js';

describe('SNOOZE_MS', () => {
  it('is 7 days in ms', () => {
    expect(SNOOZE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('isIOSSafari', () => {
  const iPhoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const iPhoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
  const iPhoneFirefox = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1';
  const androidChrome = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

  it('returns true for iPhone Safari when not standalone', () => {
    expect(isIOSSafari(iPhoneSafari, false)).toBe(true);
  });

  it('returns false when already standalone', () => {
    expect(isIOSSafari(iPhoneSafari, true)).toBe(false);
  });

  it('returns false for Chrome on iOS', () => {
    expect(isIOSSafari(iPhoneChrome, false)).toBe(false);
  });

  it('returns false for Firefox on iOS', () => {
    expect(isIOSSafari(iPhoneFirefox, false)).toBe(false);
  });

  it('returns false for Android Chrome', () => {
    expect(isIOSSafari(androidChrome, false)).toBe(false);
  });
});

describe('getDismissedAt / setDismissedAt', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing stored', () => {
    expect(getDismissedAt()).toBe(null);
  });

  it('round-trips a timestamp', () => {
    setDismissedAt(1700000000000);
    expect(getDismissedAt()).toBe(1700000000000);
  });

  it('returns null when stored value is not a number', () => {
    localStorage.setItem('installBannerDismissedAt', 'banana');
    expect(getDismissedAt()).toBe(null);
  });
});

describe('isSnoozed', () => {
  it('returns false when no dismissedAt', () => {
    expect(isSnoozed(1700000000000, null)).toBe(false);
  });

  it('returns true exactly at the boundary', () => {
    const now = 1700000000000;
    expect(isSnoozed(now, now - SNOOZE_MS + 1)).toBe(true);
  });

  it('returns false past the boundary', () => {
    const now = 1700000000000;
    expect(isSnoozed(now, now - SNOOZE_MS - 1)).toBe(false);
  });
});

describe('markEligible / isEligible', () => {
  beforeEach(() => localStorage.clear());

  it('isEligible is false by default', () => {
    expect(isEligible()).toBe(false);
  });

  it('markEligible makes isEligible true', () => {
    markEligible();
    expect(isEligible()).toBe(true);
  });

  it('persists across reads (localStorage-backed)', () => {
    markEligible();
    expect(localStorage.getItem('installPromptEligible')).toBe('1');
  });
});

describe('isStandalone', () => {
  it('returns true when display-mode standalone matches', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    expect(isStandalone()).toBe(true);
    spy.mockRestore();
  });

  it('returns true when navigator.standalone is true (iOS)', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true });
    expect(isStandalone()).toBe(true);
    spy.mockRestore();
    delete window.navigator.standalone;
  });

  it('returns false otherwise', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    expect(isStandalone()).toBe(false);
    spy.mockRestore();
  });
});
