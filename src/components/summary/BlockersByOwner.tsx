import type { BlockerColumn, FieldCoverage } from '../../../shared/types';
import { blockerGroup, cardShell, color } from '../../styles/tokens';
import { Callout, CardEyebrow } from '../primitives';

const GROUP_ORDER = ['customer', 'ramsoft', 'internal', 'clientPacs', 'technosoft'] as const;

export function BlockersByOwner({
  blockers,
  coverage,
}: {
  blockers: BlockerColumn[];
  coverage: FieldCoverage;
}) {
  const byGroup = new Map(blockers.map((column) => [column.group, column]));

  return (
    <div style={{ ...cardShell, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <CardEyebrow>Blockers by Owner</CardEyebrow>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em', color: color.textDim }}>
          Derived from RamSoft tickets and email this week
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {GROUP_ORDER.map((key) => {
          const meta = blockerGroup[key];
          const items = byGroup.get(key)?.items ?? [];

          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: meta.color,
                  borderBottom: `2px solid ${meta.border}`,
                  paddingBottom: 8,
                }}
              >
                {meta.label}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.length === 0 ? (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.42)',
                    }}
                  >
                    None flagged
                  </span>
                ) : (
                  items.map((item) => (
                    <span
                      key={`${item.label}-${item.text}`}
                      style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(255,255,255,0.85)' }}
                    >
                      <strong>{item.label}</strong> — {item.text}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CoverageCallout coverage={coverage} />
    </div>
  );
}

/**
 * Generated, not hardcoded: it reports how many in-flight centers are missing
 * `Pending Contact?` and names the worst staleness case. When every center has
 * the field set and nothing is stale, it disappears entirely.
 */
function CoverageCallout({ coverage }: { coverage: FieldCoverage }) {
  const { pendingContactMissing, inFlightCount, stalestCenter } = coverage;
  if (pendingContactMissing === 0 && !stalestCenter) return null;

  const all = pendingContactMissing === inFlightCount;

  return (
    <Callout tone="warning">
      <strong>The board still reads worse than reality.</strong>{' '}
      {pendingContactMissing > 0 && (
        <>
          “Pending Contact?” is empty on {all ? 'all ' : ''}
          {pendingContactMissing} of {inFlightCount} in-flight centers, so
          {all ? ' every' : ' each affected'} blocker above was reconstructed from email.{' '}
        </>
      )}
      {stalestCenter && (
        <>
          {stalestCenter.name} is the clearest case: {stalestCenter.note}. Until owners close
          subtasks and set the field, this dashboard understates progress.
        </>
      )}
    </Callout>
  );
}
