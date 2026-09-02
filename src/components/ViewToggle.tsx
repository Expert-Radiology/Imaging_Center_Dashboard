import type { CSSProperties } from 'react';
import { color, radius, transition } from '../styles/tokens';
import type { Freshness } from '../lib/derive';
import type { View } from '../lib/useView';

function pill(active: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '9px 18px',
    borderRadius: radius.pill,
    cursor: 'pointer',
    transition,
    border: `1px solid ${active ? color.activePillBorder : color.inactivePillBorder}`,
    background: active ? color.activePill : 'transparent',
    color: active ? color.textPrimary : color.textMuted,
  };
}

export function ViewToggle({
  view,
  onChange,
  freshness,
}: {
  view: View;
  onChange: (next: View) => void;
  freshness: Freshness;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        marginTop: -6,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          style={pill(view === 'summary')}
          aria-pressed={view === 'summary'}
          onClick={() => onChange('summary')}
        >
          Executive Summary
        </button>
        <button
          type="button"
          style={pill(view === 'matrix')}
          aria-pressed={view === 'matrix'}
          onClick={() => onChange('matrix')}
        >
          Connection Matrix
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} role="status">
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: radius.dot,
            background: freshness.dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: color.textDim,
          }}
        >
          {freshness.caption}
        </span>
      </div>
    </div>
  );
}
