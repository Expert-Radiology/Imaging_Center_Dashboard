/**
 * Expert Radiology Design System v2 — the subset this dashboard uses.
 * Transcribed from the handoff. `colors_and_type.css` in the design system
 * project is the source of truth; keep these in sync with it.
 */

export const color = {
  pageGradient:
    'linear-gradient(145deg, #0c1a2e, #0e1f38 40%, #142a4a 72%, #101e35)',
  pageBase: '#0c1a2e',

  card: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.07)',
  rowBorder: 'rgba(255,255,255,0.05)',
  zebra: 'rgba(255,255,255,0.015)',
  tableHeader: 'rgba(255,255,255,0.05)',
  groupBand: 'rgba(255,255,255,0.06)',
  headerRule: 'rgba(255,255,255,0.10)',

  primaryBlue: '#116acc',
  accentBlue: '#5ba3e6',
  lightBlue: '#7cb8ff',
  linkHover: '#93c5fd',

  excellent: '#2ecd6f',
  satisfactory: '#5ba3e6',
  watch: '#f5c451',
  serious: '#ff8a4c',
  critical: '#d92b3a',
  criticalNumber: '#ff5f6d',

  // Text on dark
  textPrimary: '#fff',
  textStrong: 'rgba(255,255,255,0.88)',
  textBody: 'rgba(255,255,255,0.82)',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.6)',
  textLabel: 'rgba(255,255,255,0.55)',
  /** Contrast floor at 10–12px. Do not go dimmer at these sizes. */
  textDim: 'rgba(255,255,255,0.45)',
  textPlaceholder: 'rgba(255,255,255,0.4)',
  glyphOff: 'rgba(255,255,255,0.32)',
  noData: 'rgba(255,255,255,0.28)',

  amberBg: 'rgba(245,196,81,0.08)',
  amberBorder: 'rgba(245,196,81,0.26)',
  infoBg: 'rgba(17,106,204,0.10)',
  infoBorder: 'rgba(17,106,204,0.30)',
  criticalRow: 'rgba(217,43,58,0.07)',
  newRow: 'rgba(91,163,230,0.06)',
  activePill: 'rgba(17,106,204,0.28)',
  activePillBorder: 'rgba(91,163,230,0.55)',
  inactivePillBorder: 'rgba(255,255,255,0.14)',
} as const;

/** Red is reserved for primary CTAs and the Flagship tag. Warnings are amber. */
export const statusColor: Record<
  'excellent' | 'satisfactory' | 'watch' | 'serious' | 'critical',
  string
> = {
  excellent: color.excellent,
  satisfactory: color.satisfactory,
  watch: color.watch,
  serious: color.serious,
  critical: color.critical,
};

export const statusLabel = {
  excellent: 'Excellent',
  satisfactory: 'Satisfactory',
  watch: 'Watch',
  serious: 'Serious',
  critical: 'Critical',
} as const;

export const blockerGroup = {
  customer: {
    label: 'Waiting on Customer',
    color: '#ff8fa0',
    border: 'rgba(255,64,129,0.45)',
  },
  ramsoft: {
    label: 'Waiting on RamSoft',
    color: '#7cb8ff',
    border: 'rgba(4,169,244,0.45)',
  },
  internal: {
    label: 'Waiting on Internal Team',
    color: '#b39dff',
    border: 'rgba(124,77,255,0.5)',
  },
  clientPacs: {
    label: "Waiting on Client's PACS",
    color: '#d9a08c',
    border: 'rgba(158,80,63,0.6)',
  },
  technosoft: {
    label: 'Waiting on Technosoft',
    color: '#d9a8e0',
    border: 'rgba(184,126,196,0.5)',
  },
} as const;

export const font = {
  family: "Montserrat, 'Montserrat Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

export const radius = {
  card: 12,
  callout: 10,
  pill: 100,
  dot: 9999,
} as const;

export const layout = {
  canvasWidth: 1600,
  contentWidth: 1504,
  pagePadding: '40px 48px 32px',
  sectionGap: 26,
  cardGap: 20,
} as const;

export const transition = 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Display headlines carry descender protection — the design system pairs a
 * padding-bottom with an equal negative margin so descenders are not clipped
 * without changing the box height.
 */
export const descenderProtection = {
  paddingBottom: '0.075em',
  marginBottom: '-0.075em',
} as const;

export const eyebrow = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
} as const;

export const cardEyebrow = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: color.textLabel,
} as const;

export const cardShell = {
  background: color.card,
  border: `1px solid ${color.cardBorder}`,
  borderRadius: radius.card,
} as const;
