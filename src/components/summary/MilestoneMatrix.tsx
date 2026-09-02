import type { CSSProperties } from 'react';
import type { Connection } from '../../../shared/types';
import { blockerGroup, color, cardShell, radius } from '../../styles/tokens';
import { clickUpUrl, daysColor } from '../../lib/derive';
import { CardEyebrow, DeepLink, EM_DASH, GlyphCell, StatusPill } from '../primitives';

const headCell: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: color.textMuted,
  padding: '11px 8px',
  textAlign: 'center',
};

const MILESTONE_COLUMNS = [
  { key: 'vpnForm', head: ['VPN', 'Form'] },
  { key: 'ping', head: ['Ping'] },
  { key: 'testStudy', head: ['Test', 'Study'] },
  { key: 'headerTemplate', head: ['Header', 'Tmpl'] },
  { key: 'ramsoftStation', head: ['RamSoft', 'Station'] },
] as const;

/** Blocker groups colour the Waiting On cell; everything else is quiet label text. */
function waitingOnStyle(connection: Connection): CSSProperties {
  if (connection.blockerGroup) {
    return {
      color: blockerGroup[connection.blockerGroup].color,
      fontSize: 11.5,
      fontWeight: 600,
    };
  }
  return { color: color.textLabel, fontSize: 11.5 };
}

function rowBackground(connection: Connection, index: number): string | undefined {
  if (connection.status === 'critical') return color.criticalRow;
  if (connection.newThisWeek) return color.newRow;
  return index % 2 === 0 ? color.zebra : undefined;
}

export function MilestoneMatrix({ connections }: { connections: Connection[] }) {
  return (
    <div style={{ ...cardShell, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
        }}
      >
        <CardEyebrow>In Flight — Milestone Matrix</CardEyebrow>
        <div
          style={{
            display: 'flex',
            gap: 18,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            color: color.textDim,
          }}
        >
          <span>
            <span style={{ color: color.excellent }}>●</span> Complete
          </span>
          <span>
            <span style={{ color: color.glyphOff }}>○</span> Not closed in ClickUp
          </span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: color.tableHeader }}>
            <th style={{ ...headCell, textAlign: 'left', padding: '11px 24px' }}>Imaging Center</th>
            <th style={{ ...headCell, textAlign: 'left' }}>Owner</th>
            <th style={headCell}>Days</th>
            {MILESTONE_COLUMNS.map((col) => (
              <th key={col.key} style={{ ...headCell, padding: '11px 6px', lineHeight: 1.3 }}>
                {col.head.map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </th>
            ))}
            <th style={{ ...headCell, textAlign: 'left', padding: '11px 16px' }}>Waiting On</th>
            <th style={{ ...headCell, textAlign: 'left', padding: '11px 24px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection, index) => (
            <tr
              key={connection.id}
              data-hoverable
              style={{
                borderTop: `1px solid ${color.rowBorder}`,
                background: rowBackground(connection, index),
              }}
            >
              <td style={{ padding: '10px 24px', fontWeight: 700 }}>
                <DeepLink href={clickUpUrl(connection)}>{connection.centerName}</DeepLink>
                {connection.qualifier && (
                  <span style={{ fontWeight: 600, color: color.textDim }}>
                    {' '}
                    · {connection.qualifier}
                  </span>
                )}
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  color: connection.owner ? color.textSecondary : color.watch,
                  fontWeight: connection.owner ? undefined : 600,
                }}
              >
                {connection.owner ?? 'Unassigned'}
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: daysColor(connection.daysInPipeline),
                }}
                title={connection.startDate ? `Started ${connection.startDate}` : 'No start date in ClickUp'}
              >
                {connection.daysInPipeline ?? EM_DASH}
              </td>
              {MILESTONE_COLUMNS.map((col) => (
                <td key={col.key} style={{ padding: '10px 6px', textAlign: 'center' }}>
                  <span style={{ fontSize: 15 }}>
                    <GlyphCell glyph={connection.milestones[col.key]} />
                  </span>
                </td>
              ))}
              <td style={{ padding: '10px 16px', ...waitingOnStyle(connection) }}>
                {connection.waitingOn ?? EM_DASH}
              </td>
              <td style={{ padding: '10px 24px' }}>
                <StatusPill status={connection.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {connections.length === 0 && (
        <div style={{ padding: '18px 24px', fontSize: 12.5, color: color.textDim }}>
          Nothing in flight.
        </div>
      )}
      <div style={{ height: 0, borderRadius: radius.card }} />
    </div>
  );
}
