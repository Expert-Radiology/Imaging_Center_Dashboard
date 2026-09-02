import type { CSSProperties } from 'react';
import type { Connection, DashboardPayload, Glyph } from '../../../shared/types';
import { blockerGroup, cardShell, color, layout } from '../../styles/tokens';
import { clickUpUrl, deploymentOrder, percentColor, ramsoftUrl } from '../../lib/derive';
import {
  Callout,
  CardEyebrow,
  DeepLink,
  EM_DASH,
  GlyphCell,
  ProgressGlyph,
} from '../primitives';

/**
 * Column widths, and why they live in a <colgroup>.
 *
 * The handoff warns that `table-layout: fixed` collapses every column to an
 * identical width, because the browser derives widths from the FIRST header row
 * — the colspan band, which carries none. That is true when the widths are
 * declared on header cells, and it is why the design file uses auto layout.
 *
 * A <colgroup> sidesteps the problem entirely: fixed layout reads it in
 * preference to any row, so the declared widths are honoured exactly and the
 * leftover space is distributed proportionally — landing on the "actual" widths
 * the handoff records. The design file could not use one only because the design
 * tool's compiler stripped it; React keeps it.
 *
 * Fixed layout also makes the widths independent of font metrics. Under auto
 * layout the browser redistributes by content, so a missing Montserrat pushes
 * Next Action from 303px to ~250px and wraps almost every row to two lines,
 * growing the table by 40%.
 */
const COLUMNS = [
  { key: 'center', head: ['Center'], width: 196, align: 'left', groupEnd: false },
  { key: 'type', head: ['Type'], width: 76, align: 'left', groupEnd: false },
  { key: 'pacs', head: ['PACS'], width: 82, align: 'left', groupEnd: false },
  { key: 'owner', head: ['Owner'], width: 66, align: 'left', groupEnd: false },
  { key: 'st', head: ['ST'], width: 34, align: 'left', groupEnd: true },
  { key: 'dicomVpn', head: ['DICOM', 'VPN'], width: 60, align: 'center', groupEnd: false },
  { key: 'hl7Vpn', head: ['HL7', 'VPN'], width: 54, align: 'center', groupEnd: false },
  { key: 'dicomStudy', head: ['DICOM', 'Study'], width: 58, align: 'center', groupEnd: false },
  { key: 'hl7Test', head: ['HL7', 'Test'], width: 50, align: 'center', groupEnd: true },
  { key: 'facility', head: ['Facility'], width: 54, align: 'center', groupEnd: false },
  { key: 'station', head: ['Station'], width: 50, align: 'center', groupEnd: false },
  { key: 'headerDotx', head: ['Header', 'DOTX'], width: 54, align: 'center', groupEnd: true },
  { key: 'pct', head: ['%'], width: 42, align: 'center', groupEnd: false },
  { key: 'estDeploy', head: ['Est.', 'Deploy'], width: 82, align: 'left', groupEnd: false },
  { key: 'blocker', head: ['Blocker'], width: 160, align: 'left', groupEnd: false },
  { key: 'nextAction', head: ['Next Action'], width: 300, align: 'left', groupEnd: false },
  { key: 'final', head: ['Final'], width: 62, align: 'left', groupEnd: false },
] as const;

const LINE_ITEM_KEYS = [
  'dicomVpn',
  'hl7Vpn',
  'dicomStudy',
  'hl7Test',
  'facility',
  'station',
  'headerDotx',
] as const;

const GROUPS = [
  { label: 'Connection', span: 5, accent: false, align: 'left' },
  { label: 'Connectivity', span: 4, accent: true, align: 'center' },
  { label: 'RamSoft Build', span: 3, accent: true, align: 'center' },
  { label: 'Close-out', span: 5, accent: false, align: 'left' },
] as const;

const groupSeparator = `1px solid rgba(255,255,255,0.07)`;
const bodySeparator = `1px solid ${color.rowBorder}`;

export function ConnectionMatrix({ payload }: { payload: DashboardPayload }) {
  const ordered = deploymentOrder(payload);
  const inFlight = ordered.filter((c) => !c.onHold);
  const held = ordered.filter((c) => c.onHold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <CardEyebrow>Connection Matrix — All Open Connections</CardEyebrow>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: color.textMuted, maxWidth: 760 }}>
            One row per connection. A center running both DICOM and HL7 appears once with its type
            declared; split into two rows when the two paths go live on different dates.
          </span>
        </div>
        <Legend />
      </div>

      <div style={{ ...cardShell, overflow: 'hidden' }}>
        <div className="matrix-scroll">
          {/*
            Never compress below the design width: at 1504 the rows sit on one
            line at 33px, and below that the handoff prefers a horizontal scroll
            to shrinking columns. Squeezing Next Action wraps almost every row
            and the table grows by 40%.
          */}
          <table
            style={{
              width: '100%',
              minWidth: layout.contentWidth,
              tableLayout: 'fixed',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: color.groupBand }}>
                {GROUPS.map((group, i) => (
                  <th
                    key={group.label}
                    colSpan={group.span}
                    style={{
                      textAlign: group.align,
                      padding: i === 0 ? '9px 24px' : '9px 8px',
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: group.accent ? color.lightBlue : 'rgba(255,255,255,0.42)',
                      borderRight: i < GROUPS.length - 1 ? groupSeparator : undefined,
                    }}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {COLUMNS.map((column, i) => (
                  <th
                    key={column.key}
                    style={{
                      textAlign: column.align,
                      padding:
                        i === 0
                          ? '10px 24px'
                          : i === COLUMNS.length - 1
                            ? '10px 24px 10px 4px'
                            : '10px 4px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: column.head.length > 1 ? '0.04em' : '0.05em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.62)',
                      lineHeight: 1.3,
                      borderRight: column.groupEnd ? groupSeparator : undefined,
                    }}
                  >
                    {column.head.map((line, j) => (
                      <span key={line}>
                        {j > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {inFlight.map((connection, index) => (
                <MatrixRow key={connection.id} connection={connection} index={index} />
              ))}

              {held.length > 0 && (
                <tr
                  style={{
                    borderTop: `2px solid ${color.headerRule}`,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <td
                    colSpan={COLUMNS.length}
                    style={{
                      padding: '10px 24px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.42)',
                    }}
                  >
                    On Hold — no hold reason or review date recorded
                  </td>
                </tr>
              )}

              {held.map((connection, index) => (
                <MatrixRow
                  key={connection.id}
                  connection={connection}
                  index={inFlight.length + index}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MatrixCallouts payload={payload} />
    </div>
  );
}

function Legend() {
  const item: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5 };
  return (
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
      <span style={item}>
        <span style={{ color: color.excellent }}>●</span> Done
      </span>
      <span style={item}>
        <ProgressGlyph size={11} /> In progress
      </span>
      <span style={item}>
        <span style={{ color: color.glyphOff }}>○</span> Not done
      </span>
      <span style={{ color: color.textDim }}>n/a — not in scope</span>
    </div>
  );
}

function MatrixRow({ connection, index }: { connection: Connection; index: number }) {
  const held = connection.onHold;

  // Held rows are quieter via row background, never by dimming type below the
  // 0.45 contrast floor — leadership makes keep-or-close calls off this block.
  const background = held
    ? index % 2 === 0
      ? color.zebra
      : undefined
    : connection.status === 'critical'
      ? color.criticalRow
      : connection.newThisWeek
        ? color.newRow
        : index % 2 === 0
          ? color.zebra
          : undefined;

  const cell = (extra: CSSProperties = {}): CSSProperties => ({
    padding: '9px 4px',
    ...extra,
  });

  const glyphCell = (key: (typeof LINE_ITEM_KEYS)[number], groupEnd: boolean) => (
    <td
      key={key}
      style={cell({
        textAlign: 'center',
        borderRight: groupEnd ? bodySeparator : undefined,
      })}
    >
      <GlyphCell glyph={connection.lineItems[key] as Glyph} dimmed={held} />
    </td>
  );

  const estimate = connection.estimatedDeployment;
  const estimateColor = !estimate
    ? color.textPlaceholder
    : estimate.label === 'On hold'
      ? color.textLabel
      : estimate.proposed
        ? color.textSecondary
        : color.textPlaceholder;

  return (
    <tr data-hoverable style={{ borderTop: bodySeparator, background }}>
      <td style={cell({ padding: '9px 24px', fontWeight: 700, color: held ? 'rgba(255,255,255,0.86)' : undefined })}>
        <DeepLink href={clickUpUrl(connection)}>{connection.centerName}</DeepLink>
      </td>
      <td style={cell({ color: 'rgba(255,255,255,0.66)' })}>{connection.connectionType ?? EM_DASH}</td>
      <td style={cell({ color: held ? 'rgba(255,255,255,0.5)' : color.textPlaceholder })}>
        {connection.pacsVendor ?? 'Not set'}
      </td>
      <td style={cell({ color: connection.owner ? color.textSecondary : color.watch, fontWeight: connection.owner ? undefined : 600 })}>
        {connection.owner ?? 'None'}
      </td>
      <td
        style={cell({
          color: held ? 'rgba(255,255,255,0.5)' : color.textMuted,
          borderRight: bodySeparator,
        })}
      >
        {connection.state ?? EM_DASH}
      </td>

      {LINE_ITEM_KEYS.map((key) =>
        glyphCell(key, key === 'hl7Test' || key === 'headerDotx'),
      )}

      <td
        style={cell({
          textAlign: 'center',
          fontWeight: 700,
          color: held ? 'rgba(255,255,255,0.68)' : percentColor(connection.percentComplete),
        })}
      >
        {connection.percentComplete ?? EM_DASH}
      </td>
      <td style={cell({ color: estimateColor })}>
        {estimate ? `${estimate.label}${estimate.proposed ? '*' : ''}` : EM_DASH}
      </td>
      <td
        style={cell({
          fontSize: 11,
          fontWeight: 600,
          color: connection.blockerGroup
            ? blockerGroup[connection.blockerGroup].color
            : color.textDim,
        })}
      >
        <BlockerCell connection={connection} />
      </td>
      <td
        style={cell({
          fontSize: 11.5,
          color: held ? 'rgba(255,255,255,0.78)' : color.textBody,
        })}
      >
        {connection.nextAction ?? EM_DASH}
      </td>
      <td style={cell({ padding: '9px 24px 9px 4px' })}>
        <FinalFlag connection={connection} />
      </td>
    </tr>
  );
}

/** Ticket references become links when we have the id. */
function BlockerCell({ connection }: { connection: Connection }) {
  // "None flagged" means nobody has raised a blocker; "Not recorded" means the
  // connection is parked and nobody wrote down why. Different facts.
  const text =
    connection.blockerText ?? (connection.onHold ? 'Not recorded' : 'None flagged');
  const href = ramsoftUrl(connection.ramsoftTicketId);
  if (!href || !connection.ramsoftTicketId || !text.includes(connection.ramsoftTicketId)) {
    return <>{text}</>;
  }

  const [before, after] = text.split(`#${connection.ramsoftTicketId}`);
  return (
    <>
      {before}
      <a href={href} target="_blank" rel="noreferrer noopener">
        #{connection.ramsoftTicketId}
      </a>
      {after}
    </>
  );
}

function FinalFlag({ connection }: { connection: Connection }) {
  const label =
    connection.finalFlag === 'done'
      ? 'Done'
      : connection.finalFlag === 'onhold'
        ? 'On hold'
        : 'Not done';
  const flagColor =
    connection.finalFlag === 'done'
      ? color.excellent
      : connection.finalFlag === 'onhold'
        ? 'rgba(255,255,255,0.62)'
        : '#ff8fa0';

  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: flagColor,
      }}
    >
      {label}
    </span>
  );
}

const FIELD_LABELS: Record<string, string> = {
  hl7VpnStatus: 'HL7 VPN',
  hl7TestingStatus: 'HL7 testing',
  facilityStationSplit: 'facility-vs-station split',
  estimatedDeploymentDate: 'estimated deployment date',
};

/** Both callouts are generated from actual field coverage, not hardcoded. */
function MatrixCallouts({ payload }: { payload: DashboardPayload }) {
  const missing = payload.fieldCoverage.missingFields;
  const proposedCount = payload.connections.filter(
    (c) => c.estimatedDeployment?.proposed,
  ).length;

  if (missing.length === 0 && proposedCount === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {missing.length > 0 && (
        <Callout tone="warning">
          <strong>
            {missing.length === 1
              ? 'One column has'
              : `${spellOut(missing.length)} columns have`}{' '}
            no ClickUp source yet.
          </strong>{' '}
          {missing.map((f) => FIELD_LABELS[f] ?? f).join(', ')}{' '}
          {missing.length === 1 ? 'is not a field' : 'are not fields'} on the list — the values
          above come from subtask names and email. Adding them as real custom fields is what makes
          this matrix self-updating instead of hand-maintained.
        </Callout>
      )}
      {proposedCount > 0 && (
        <Callout tone="info">
          <strong>Dates marked * are proposed.</strong> No go-live date exists in ClickUp for any
          open connection. Confirm the sequence in this meeting and it becomes the baseline the
          “actually completed” row is measured against.
        </Callout>
      )}
    </div>
  );
}

function spellOut(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][n] ?? String(n);
}
