import { useCallback, useEffect, useState } from 'react';

export type View = 'summary' | 'matrix';

const PARAM = 'view';

function fromUrl(): View | null {
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return value === 'matrix' || value === 'summary' ? value : null;
}

/**
 * View selection, persisted in the URL so `?view=matrix` opens straight to the
 * matrix — Cristian will send that link to BD.
 *
 * Resolution order is deliberately `state ?? url ?? fallback`. The prototype
 * resolved it as `prop ?? state`, and because the prop always had a default the
 * prop always won and clicking the toggle did nothing. An interaction must beat
 * a configured default.
 */
export function useView(fallback: View = 'summary'): [View, (next: View) => void] {
  const [state, setState] = useState<View | null>(null);
  const [urlView, setUrlView] = useState<View | null>(() => fromUrl());

  const view = state ?? urlView ?? fallback;

  const setView = useCallback((next: View) => {
    setState(next);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, next);
    window.history.replaceState(null, '', url);
  }, []);

  // Back/forward should still move between the two views.
  useEffect(() => {
    const onPop = () => {
      setState(null);
      setUrlView(fromUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [view, setView];
}
