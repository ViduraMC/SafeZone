/** Colour tokens taken from the hi-fi wireframes (navy header, severity colours). */
export const colors = {
  navy: '#13294b',
  navy2: '#1e3a66',
  critical: '#c62828',
  criticalBg: '#fdecec',
  warning: '#e8704a',
  warningBg: '#fdf0ea',
  watch: '#c79a12',
  watchBg: '#fdf7e1',
  advisory: '#2e7d4f',
  advisoryBg: '#e7f4ec',
  info: '#2563a8',
  infoBg: '#e8f0fa',
  bg: '#f4f1ec',
  surface: '#ffffff',
  border: '#e3ded5',
  text: '#16213a',
  muted: '#6b7280',
  white: '#ffffff',
} as const;

export const radius = 14;
export const space = 12;

export type Tone = 'critical' | 'warning' | 'watch' | 'advisory' | 'neutral' | 'success' | 'info' | 'danger';

/** Foreground and background colour for each tone. */
export const toneColors: Readonly<Record<Tone, { fg: string; bg: string }>> = {
  critical: { fg: colors.critical, bg: colors.criticalBg },
  danger: { fg: colors.critical, bg: colors.criticalBg },
  warning: { fg: colors.warning, bg: colors.warningBg },
  watch: { fg: colors.watch, bg: colors.watchBg },
  advisory: { fg: colors.advisory, bg: colors.advisoryBg },
  success: { fg: colors.advisory, bg: colors.advisoryBg },
  info: { fg: colors.info, bg: colors.infoBg },
  neutral: { fg: colors.muted, bg: '#eef0f3' },
};
