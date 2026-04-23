// LaunchLense Design Tokens — PROOF Warm Editorial
export const colors = {
  canvas:   '#FAFAF8',
  surface:  '#FFFFFF',
  faint:    '#F3F0EB',
  border:   '#E8E4DC',
  ink:      '#111110',
  muted:    '#8C8880',
  go:       '#059669',
  warn:     '#D97706',
  stop:     '#DC2626',
  // legacy aliases
  bg:       '#FAFAF8',
  text:     '#111110',
  success:  '#059669',
  danger:   '#DC2626',
} as const;

export function statusColor(status: 'red' | 'yellow' | 'green' | string): string {
  switch (status) {
    case 'green': return colors.go;
    case 'yellow': return colors.warn;
    case 'red': return colors.stop;
    default: return colors.muted;
  }
}

export function statusFromScore(score: number): 'red' | 'yellow' | 'green' {
  if (score < 60) return 'red';
  if (score < 85) return 'yellow';
  return 'green';
}
