import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardPayload } from '../../shared/types';
import { seedPayload } from '../data/seed';

/**
 * The server refreshes hourly; the browser polls more often than that so a wall
 * display picks up a new payload soon after it lands, rather than up to an hour
 * later. Polling is cheap — one cached GET against the app's own origin.
 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const ENDPOINT = '/api/dashboard';

export interface DashboardState {
  payload: DashboardPayload;
  lastError: string | null;
  refreshing: boolean;
  refresh: () => void;
}

/**
 * One payload, refreshed every 15 minutes.
 *
 * Three behaviours the design depends on:
 *  - A failed refresh never blanks the board. The last good payload stays, and
 *    the error surfaces in the freshness strip instead.
 *  - Hidden tabs do not fetch. A wall display left open overnight should not
 *    poll all night for nobody, and returning to the tab refetches at once.
 *  - The bundled seed renders immediately, so the page is never empty on load.
 */
export function useDashboardData(): DashboardState {
  const [payload, setPayload] = useState<DashboardPayload>(seedPayload);
  const [lastError, setLastError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setRefreshing(true);

    try {
      const response = await fetch(ENDPOINT, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const next = (await response.json()) as DashboardPayload;
      if (!next || !Array.isArray(next.connections)) {
        throw new Error('malformed payload');
      }

      setPayload(next);
      setLastError(null);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      // Keep whatever is on screen. Say so rather than showing stale as fresh.
      setLastError(describe(error));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      inFlight.current?.abort();
    };
  }, [refresh]);

  return { payload, lastError, refreshing, refresh: () => void refresh() };
}

function describe(error: unknown): string {
  if (error instanceof TypeError) return 'network unreachable';
  return error instanceof Error ? error.message : 'unknown error';
}
