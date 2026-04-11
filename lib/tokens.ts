// LaunchLense Design Tokens
// Bloomberg Terminal for Startup Risk

export const colors = {
  bg: '#0A0A0A',
  surface: '#111111',
  card: '#171717',
  border: '#262626',
  text: '#FAFAFA',
  muted: '#A1A1A1',
  success: '#22C55E',
  warn: '#EAB308',
  danger: '#EF4444',
} as const;

export function statusColor(status: 'red' | 'yellow' | 'green' | string): string {
  switch (status) {
    case 'green':
      return colors.success;
    case 'yellow':
      return colors.warn;
    case 'red':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function statusFromScore(score: number): 'red' | 'yellow' | 'green' {
  if (score < 60) return 'red';
  if (score < 85) return 'yellow';
  return 'green';
}
