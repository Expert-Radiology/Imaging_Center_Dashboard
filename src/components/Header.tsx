import { color, descenderProtection } from '../styles/tokens';
import { formatHeaderDate } from '../lib/week';

export function Header({ weekLabel, now }: { weekLabel: string; now: Date }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${color.headerRule}`,
        paddingBottom: 20,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: color.accentBlue,
          }}
        >
          Weekly Executive Status Summary
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: '-0.01em',
            ...descenderProtection,
          }}
        >
          Imaging Center Onboarding{' '}
          <span style={{ color: 'rgba(255,255,255,0.34)', fontWeight: 700 }}>|</span>{' '}
          <span style={{ color: color.accentBlue }}>Pipeline Review</span>
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: color.textPrimary }}>
          {formatHeaderDate(now)}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: color.textLabel,
          }}
        >
          {weekLabel}
        </span>
      </div>
    </div>
  );
}
