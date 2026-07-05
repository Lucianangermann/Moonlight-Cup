import { useEffect, useRef } from 'react';

// Repeatedly calls `fn` every `intervalMs`, pausing while the browser tab is
// hidden and refreshing immediately when it becomes visible again — avoids
// wasting Pi/gunicorn cycles on backgrounded phones during a live event.
// Web-only (document.visibilitychange); native builds aren't a target here
// (this app is only ever deployed as an Expo web export, see App.js).
export function usePolling(fn, intervalMs) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let timer;

    const tick = async () => {
      // Guard against a second interleaved loop: if a fetch is mid-flight
      // when the tab regains visibility, onVisibility would otherwise start
      // a parallel tick chain that doubles the poll rate permanently.
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        await fnRef.current();
      } catch {
        // A single failed poll shouldn't stop the loop — next tick retries.
      } finally {
        inFlight = false;
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      clearTimeout(timer);
      if (document.visibilityState === 'visible') tick();
    };

    tick();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      alive = false;
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [intervalMs]);
}
