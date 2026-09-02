import { useEffect, useState } from 'react';
import { color, font, layout } from './styles/tokens';
import { Header } from './components/Header';
import { ViewToggle } from './components/ViewToggle';
import { Footer } from './components/Footer';
import { ExecutiveSummary } from './components/summary/ExecutiveSummary';
import { ConnectionMatrix } from './components/matrix/ConnectionMatrix';
import { useDashboardData } from './lib/useDashboardData';
import { useView } from './lib/useView';
import { freshness } from './lib/derive';
import { currentWeek } from './lib/week';

/** Re-render the clock-dependent strip once a minute; data refreshes on its own cadence. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function App() {
  const { payload, lastError } = useDashboardData();
  const [view, setView] = useView('summary');
  const now = useNow();

  // The header always shows the real current HQ week, even when the payload
  // being rendered is an older snapshot.
  const week = currentWeek(now);
  const state = freshness(payload, lastError, now);

  return (
    <div
      style={{
        width: layout.canvasWidth,
        maxWidth: '100%',
        fontFamily: font.family,
        background: color.pageGradient,
        color: color.textPrimary,
        padding: layout.pagePadding,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: layout.sectionGap,
        minHeight: '100vh',
      }}
    >
      <Header weekLabel={week.label} now={now} />
      <ViewToggle view={view} onChange={setView} freshness={state} />

      {view === 'summary' ? (
        <ExecutiveSummary payload={payload} />
      ) : (
        <ConnectionMatrix payload={payload} />
      )}

      <Footer totalCenters={payload.totals.totalCenters} open={payload.totals.open} />
    </div>
  );
}
