import type { DashboardPayload } from '../../../shared/types';
import { color, radius } from '../../styles/tokens';
import { Card, CardEyebrow, StatusPill } from '../primitives';
import { STATUS_ORDER } from '../../lib/derive';
import { statusColor, statusLabel } from '../../styles/tokens';

export function TeamCard({ team }: { team: DashboardPayload['team'] }) {
  const value = { color: color.textBody };

  return (
    <Card gap={16}>
      <CardEyebrow>Onboarding Team</CardEyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 14, lineHeight: 1.35 }}>
        <div>
          <span style={{ fontWeight: 700 }}>Project Lead:</span>{' '}
          <span style={value}>{team.projectLead}</span>
        </div>
        <div>
          <span style={{ fontWeight: 700 }}>Onboarding &amp; Integrations:</span>{' '}
          <span style={value}>{team.onboardingIntegrations}</span>
        </div>
        <div>
          <span style={{ fontWeight: 700 }}>Client Success:</span>{' '}
          <span style={value}>{team.clientSuccess}</span>
        </div>
        <div style={{ marginTop: 4, paddingTop: 12, borderTop: `1px solid ${color.hairline}` }}>
          <span style={{ fontWeight: 700 }}>Center owners in ClickUp:</span>{' '}
          <span style={value}>
            {team.centerOwners.length ? team.centerOwners.join(', ') : '—'}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function StatusScaleCard({
  overall,
  lastWeek,
}: {
  overall: DashboardPayload['overallStatus'];
  lastWeek: DashboardPayload['lastWeekStatus'];
}) {
  return (
    <Card gap={18}>
      <CardEyebrow>Status Scale</CardEyebrow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {STATUS_ORDER.map((key) => (
          <div
            key={key}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: '100%',
                height: 5,
                borderRadius: radius.pill,
                background: statusColor[key],
              }}
            />
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: color.textSecondary,
                textAlign: 'center',
              }}
            >
              {statusLabel[key]}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 4,
          borderTop: `1px solid ${color.hairline}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>Overall pipeline status</span>
          <StatusPill status={overall} size="md" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary }}>
            Last week
          </span>
          {lastWeek ? (
            <StatusPill status={lastWeek} size="md" faded />
          ) : (
            // No Monday snapshot yet — a gap, not a guess.
            <span style={{ fontSize: 11, fontWeight: 600, color: color.noData }}>
              No snapshot yet
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function KpiCard({ value, label }: { value: number; label: string[] }) {
  return (
    <Card padding="18px 20px" gap={6}>
      <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: color.textPrimary }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.35,
        }}
      >
        {label.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </span>
    </Card>
  );
}

export function KpiTrio({ totals }: { totals: DashboardPayload['totals'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <KpiCard value={totals.newThisWeek} label={['New centers entered', 'pipeline this week']} />
      <KpiCard value={totals.liveThisWeek} label={['Centers live', 'this week']} />

      <div
        style={{
          gridColumn: 'span 2',
          background: color.amberBg,
          border: `1px solid ${color.amberBorder}`,
          borderRadius: radius.card,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: color.watch }}>
          {totals.inFlight}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.4,
          }}
        >
          Centers in flight, of {totals.open} open
          <br />— {totals.onHold} parked on hold
        </span>
      </div>
    </div>
  );
}

export function ParkedCard({ names }: { names: string[] }) {
  return (
    <Card gap={14}>
      <CardEyebrow>Parked — On Hold</CardEyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {names.map((name) => (
          <span
            key={name}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.78)',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: radius.pill,
              padding: '6px 12px',
            }}
          >
            {name}
          </span>
        ))}
        {names.length === 0 && (
          <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'rgba(255,255,255,0.42)' }}>
            Nothing parked
          </span>
        )}
      </div>
      {names.length > 0 && (
        <span style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)' }}>
          No hold reason or review date recorded on any of the {names.length === 7 ? 'seven' : names.length}.
          Decide keep or close.
        </span>
      )}
    </Card>
  );
}
