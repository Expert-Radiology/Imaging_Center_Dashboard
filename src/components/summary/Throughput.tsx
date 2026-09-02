import type { CSSProperties } from 'react';
import type { ThroughputWeek } from '../../../shared/types';
import { cardShell, color } from '../../styles/tokens';
import { Callout, CardEyebrow, EM_DASH } from '../primitives';

const rowLabel: CSSProperties = {
  padding: '16px 24px',
  width: 210,
};

const numberCell: CSSProperties = {
  padding: '16px 8px',
  textAlign: 'center',
  fontSize: 30,
  fontWeight: 800,
};

export function Throughput({
  weeks,
  unscheduled,
  inFlightCount,
}: {
  weeks: ThroughputWeek[];
  unscheduled: string[];
  inFlightCount: number;
}) {
  const expectedTotal = weeks.reduce((sum, w) => sum + w.expected, 0);
  const measured = weeks.filter((w) => w.actual !== null);
  const actualTotal = measured.reduce((sum, w) => sum + (w.actual ?? 0), 0);
  const anyProposed = expectedTotal > 0;

  return (
    <div style={{ ...cardShell, padding: '22px 0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          padding: '0 24px',
        }}
      >
        <CardEyebrow>Integration Throughput — Planned vs. Actual</CardEyebrow>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em', color: color.textDim }}>
          Six weeks forward visibility · go-live counted on first live study read
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                ...rowLabel,
                textAlign: 'left',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: color.textMuted,
                paddingTop: 0,
                paddingBottom: 14,
              }}
            >
              Week
            </th>
            {weeks.map((week) => (
              <th key={week.label} style={{ padding: '0 8px 14px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{week.label}</span>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 6,
                    paddingBottom: 6,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: week.isCurrent ? color.accentBlue : 'rgba(255,255,255,0.35)',
                    borderBottom: week.isCurrent
                      ? `2px solid ${color.activePillBorder}`
                      : `1px solid ${color.headerRule}`,
                  }}
                >
                  {week.sublabel}
                </span>
              </th>
            ))}
            <th
              style={{
                width: 120,
                padding: '0 24px 14px 8px',
                textAlign: 'center',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: color.textMuted,
                lineHeight: 1.3,
              }}
            >
              6-Week
              <br />
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          <tr style={{ borderTop: `1px solid ${color.rowBorder}` }}>
            <td style={rowLabel}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                Expected to complete
              </span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: color.textDim }}>
                Target go-lives
              </span>
            </td>
            {weeks.map((week) => (
              <td
                key={week.label}
                style={{
                  ...numberCell,
                  color: week.isCurrent ? color.accentBlue : color.textBody,
                }}
              >
                {week.expected}
              </td>
            ))}
            <td style={{ ...numberCell, padding: '16px 24px 16px 8px', color: color.textPrimary }}>
              {expectedTotal}
            </td>
          </tr>

          <tr style={{ borderTop: `1px solid ${color.rowBorder}` }}>
            <td style={rowLabel}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                Actually completed
              </span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: color.textDim }}>
                Confirmed live
              </span>
            </td>
            {weeks.map((week) => (
              <td
                key={week.label}
                style={{
                  ...numberCell,
                  // A measured zero and a week that cannot be measured yet are
                  // different facts, and the design says so.
                  color: week.actual === null ? color.noData : color.textBody,
                }}
                title={week.actual === null ? 'Not yet measurable' : undefined}
              >
                {week.actual === null ? EM_DASH : week.actual}
              </td>
            ))}
            <td style={{ ...numberCell, padding: '16px 24px 16px 8px', color: color.textPrimary }}>
              {actualTotal}
            </td>
          </tr>

          <tr style={{ borderTop: `1px solid ${color.rowBorder}` }}>
            <td style={{ ...rowLabel, verticalAlign: 'top' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: color.textMuted,
                }}
              >
                Centers in scope
              </span>
            </td>
            {weeks.map((week) => (
              <td
                key={week.label}
                style={{
                  padding: '14px 8px',
                  textAlign: 'center',
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  color: color.textSecondary,
                  verticalAlign: 'top',
                }}
              >
                {week.centersInScope.length === 0 ? (
                  <span style={{ color: color.noData }}>{EM_DASH}</span>
                ) : (
                  week.centersInScope.map((name, i) => (
                    <span key={name}>
                      {i > 0 && <br />}
                      {name}
                    </span>
                  ))
                )}
              </td>
            ))}
            <td
              style={{
                padding: '14px 24px 14px 8px',
                textAlign: 'center',
                fontSize: 11.5,
                fontWeight: 600,
                color: color.textSecondary,
                verticalAlign: 'top',
              }}
            >
              {inFlightCount} in flight
            </td>
          </tr>
        </tbody>
      </table>

      {anyProposed && (
        <div style={{ padding: '0 24px' }}>
          <Callout tone="info">
            <strong>Still a proposed sequence, not committed dates</strong> — no go-live date exists
            in ClickUp for any in-flight center. The plan spreads {expectedTotal} of the{' '}
            {inFlightCount} in-flight centers over six weeks
            {unscheduled.length > 0 && (
              <>
                {' '}
                and holds the remaining {unscheduled.length} ({unscheduled.join(', ')}) as
                unscheduled
              </>
            )}
            . Confirm the sequence here and it becomes next week’s baseline.
          </Callout>
        </div>
      )}
    </div>
  );
}
