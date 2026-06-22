import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallBanner from './InstallBanner.jsx';
import { markEligible } from '../lib/installPrompt.js';
import * as posthogClient from '../lib/posthogClient.js';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  });
});

function fireBeforeInstallPrompt(promptImpl = vi.fn(), userChoice = Promise.resolve({ outcome: 'accepted' })) {
  const event = new Event('beforeinstallprompt');
  event.prompt = promptImpl;
  event.userChoice = userChoice;
  event.preventDefault = vi.fn();
  window.dispatchEvent(event);
  return event;
}

describe('<InstallBanner /> — Android Chrome path', () => {
  it('renders nothing when not eligible', () => {
    render(<InstallBanner />);
    expect(screen.queryByText(/install iroyinmarket/i)).toBeNull();
  });

  it('renders nothing when eligible but no beforeinstallprompt fired', () => {
    markEligible();
    render(<InstallBanner />);
    expect(screen.queryByText(/install iroyinmarket/i)).toBeNull();
  });

  it('shows install button when eligible AND beforeinstallprompt has fired', () => {
    markEligible();
    render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument();
  });

  it('calls prompt() when Install clicked', async () => {
    markEligible();
    render(<InstallBanner />);
    const prompt = vi.fn();
    act(() => { fireBeforeInstallPrompt(prompt, Promise.resolve({ outcome: 'accepted' })); });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('hides itself after Not now and stays hidden after remount', () => {
    markEligible();
    const { unmount } = render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('button', { name: /^install$/i })).toBeNull();
    unmount();
    render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.queryByRole('button', { name: /^install$/i })).toBeNull();
  });

  it('does not render when already standalone', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    markEligible();
    render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.queryByText(/install iroyinmarket/i)).toBeNull();
  });

  it('reacts to installeligible event when not eligible at mount', () => {
    // eligibility NOT marked at mount time
    render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.queryByRole('button', { name: /^install$/i })).toBeNull();
    // mark eligible mid-session (dispatches the event)
    act(() => { markEligible(); });
    expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument();
  });

  it('captures app_installed when the appinstalled event fires', () => {
    const spy = vi.spyOn(posthogClient, 'capture');
    markEligible();
    render(<InstallBanner />);
    act(() => { fireBeforeInstallPrompt(); });
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(spy).toHaveBeenCalledWith('app_installed');
  });

  it('captures install_prompt_error when prompt() throws', async () => {
    const spy = vi.spyOn(posthogClient, 'capture');
    markEligible();
    render(<InstallBanner />);
    const failingPrompt = vi.fn(() => Promise.reject(new Error('boom')));
    act(() => { fireBeforeInstallPrompt(failingPrompt); });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    await new Promise(r => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith('install_prompt_error', expect.objectContaining({ message: expect.stringContaining('boom') }));
  });
});

describe('<InstallBanner /> — iOS Safari path', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  });

  it('shows instructional banner when eligible', () => {
    markEligible();
    render(<InstallBanner />);
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
  });

  it('hides itself after Got it and stays hidden after remount', () => {
    markEligible();
    const { unmount } = render(<InstallBanner />);
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByText(/Add to Home Screen/i)).toBeNull();
    unmount();
    render(<InstallBanner />);
    expect(screen.queryByText(/Add to Home Screen/i)).toBeNull();
  });
});
