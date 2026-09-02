import type { CSSProperties, ReactNode } from 'react';
import type { Glyph, StatusKey } from '../../shared/types';
import { cardShell, color, radius, statusColor, statusLabel } from '../styles/tokens';

/** The em dash the design uses wherever ClickUp has no value. Gaps stay gaps. */
export const EM_DASH = '—';

export function Card({
  children,
  style,
  padding = '22px 24px',
  gap,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: CSSProperties['padding'];
  gap?: number;
}) {
  return (
    <div
      style={{
        ...cardShell,
        padding,
        display: 'flex',
        flexDirection: 'column',
        ...(gap !== undefined ? { gap } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardEyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color.textLabel,
      }}
    >
      {children}
    </span>
  );
}

export function StatusPill({
  status,
  size = 'sm',
  faded = false,
}: {
  status: StatusKey;
  size?: 'sm' | 'md';
  faded?: boolean;
}) {
  const background = faded ? fadedStatus(status) : statusColor[status];
  return (
    <span
      style={{
        fontSize: size === 'md' ? 11 : 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        // Dark ink on the light status fills; white only on critical's red.
        color: status === 'critical' && !faded ? color.textPrimary : color.pageBase,
        background,
        borderRadius: radius.pill,
        padding: size === 'md' ? (faded ? '4px 12px' : '5px 12px') : '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel[status]}
    </span>
  );
}

const FADED_STATUS: Record<StatusKey, string> = {
  excellent: 'rgba(46,205,111,0.55)',
  satisfactory: 'rgba(91,163,230,0.55)',
  watch: 'rgba(245,196,81,0.55)',
  serious: 'rgba(255,138,76,0.55)',
  critical: 'rgba(217,43,58,0.55)',
};

function fadedStatus(status: StatusKey): string {
  return FADED_STATUS[status];
}

/**
 * The in-progress glyph is an SVG on purpose. U+25D2 has no glyph in Montserrat
 * and falls back to a colour emoji font, which ignores the authored amber — and
 * the design system forbids emoji outright.
 */
export function ProgressGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="In progress"
      style={{ verticalAlign: '-1px' }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={color.watch} strokeWidth="2.4" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill={color.watch} />
    </svg>
  );
}

/** Milestone / line-item cell. `na` is "not in scope", never "unknown". */
export function GlyphCell({ glyph, dimmed = false }: { glyph: Glyph; dimmed?: boolean }) {
  if (glyph === 'progress') return <ProgressGlyph />;

  if (glyph === 'na') {
    return (
      <span style={{ fontSize: 10, color: color.textDim }} title="Not in scope">
        n/a
      </span>
    );
  }

  const done = glyph === 'done';
  return (
    <span
      style={{
        fontSize: 14,
        color: done ? color.excellent : dimmed ? color.textPlaceholder : color.glyphOff,
      }}
      title={done ? 'Done' : 'Not done'}
    >
      {done ? '●' : '○'}
    </span>
  );
}

export function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color.watch}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color.lightBlue}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

/** Amber is the warning affordance. Red is reserved for CTAs and the Flagship tag. */
export function Callout({ tone, children }: { tone: 'warning' | 'info'; children: ReactNode }) {
  const warning = tone === 'warning';
  return (
    <div
      style={{
        background: warning ? color.amberBg : color.infoBg,
        border: `1px solid ${warning ? color.amberBorder : color.infoBorder}`,
        borderRadius: radius.callout,
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {warning ? <WarningIcon /> : <InfoIcon />}
      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: color.textBody }}>{children}</span>
    </div>
  );
}

/** External link in the design system's blue, never browser-default. */
export function DeepLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
