import type { DecisionCard } from '../../../shared/types';
import { cardShell, color, radius, statusColor } from '../../styles/tokens';
import { CardEyebrow } from '../primitives';

/**
 * Editorial. A human decides what the meeting discusses; rule-flagged
 * candidates arrive with `nextStep: null` and say so rather than having copy
 * invented for them.
 */
export function Decisions({ decisions }: { decisions: DecisionCard[] }) {
  if (decisions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CardEyebrow>Needs a Decision This Meeting</CardEyebrow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {decisions.map((card) => (
          <div
            key={card.id}
            style={{
              ...cardShell,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{card.title}</span>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: radius.dot,
                  background: statusColor[card.status],
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {card.meta.map((line) => (
                <span
                  key={line}
                  style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(255,255,255,0.62)' }}
                >
                  {line}
                </span>
              ))}
            </div>

            <div
              style={{
                paddingTop: 12,
                borderTop: `1px solid ${color.hairline}`,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {card.nextStep ? (
                <>
                  <span style={{ fontWeight: 700, color: color.accentBlue }}>Next step:</span>{' '}
                  <span style={{ color: color.textStrong }}>{card.nextStep}</span>
                </>
              ) : (
                <span style={{ color: color.noData }}>
                  Next step not written — flagged by rule, needs an owner’s call.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
