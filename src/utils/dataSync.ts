import { useEffect, useRef } from 'react';
import { api } from '../services/api';

/**
 * Keeps open screens up to date. The server counts every save; while the app is open and shown,
 * the count is checked every few seconds and whenever the window comes back, and each screen that
 * listens reloads its figures when it moves (a collector's payment shows on the office's Home
 * without leaving the page).
 */
const CHANGED_EVENT = 'krs-data-changed';
const CHECK_EVERY_MS = 15000;

/** Starts watching for changes; returns the stop function. Called once while someone is signed in. */
export function watchDataChanges(): () => void {
  let last: number | null = null;
  let busy = false;
  const check = async () => {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const version = await api.getDataVersion();
      if (last !== null && version !== last) window.dispatchEvent(new Event(CHANGED_EVENT));
      last = version;
    } catch {
      // Offline or signed out: try again on the next round.
    } finally {
      busy = false;
    }
  };
  check();
  const timer = setInterval(check, CHECK_EVERY_MS);
  const onShow = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', onShow);
  window.addEventListener('focus', onShow);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onShow);
    window.removeEventListener('focus', onShow);
  };
}

/** Runs `reload` whenever the data changed somewhere else (another screen, phone or office). */
export function useDataChanged(reload: () => unknown, enabled = true): void {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      try {
        const out = latest.current();
        if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(() => undefined);
      } catch {
        // A failed quiet reload keeps what is on screen.
      }
    };
    window.addEventListener(CHANGED_EVENT, run);
    return () => window.removeEventListener(CHANGED_EVENT, run);
  }, [enabled]);
}
