import { color } from '../styles/tokens';

export function Footer({ totalCenters, open }: { totalCenters: number; open: number }) {
  const line = {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: color.textPlaceholder,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        paddingTop: 18,
        borderTop: `1px solid ${color.hairline}`,
      }}
    >
      <span style={line}>
        Expert Radiology™ · Imaging Center Onboarding · Reviewed weekly, Monday
      </span>
      <span style={line}>
        Source: ClickUp list “Imaging Center Onboarding” · {totalCenters} centers, {open} open
      </span>
    </div>
  );
}
