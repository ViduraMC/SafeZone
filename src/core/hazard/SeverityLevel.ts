/** Official warning levels, ordered from least to most severe. */
export enum SeverityLevel {
  ADVISORY = 'ADVISORY',
  WARNING = 'WARNING',
  EMERGENCY = 'EMERGENCY',
}

const ORDER: readonly SeverityLevel[] = [SeverityLevel.ADVISORY, SeverityLevel.WARNING, SeverityLevel.EMERGENCY];

export function severityRank(level: SeverityLevel): number {
  return ORDER.indexOf(level);
}

export function isHigherSeverity(candidate: SeverityLevel, current: SeverityLevel): boolean {
  return severityRank(candidate) > severityRank(current);
}

export function allSeverityLevels(): readonly SeverityLevel[] {
  return ORDER;
}

export function isSeverityLevel(value: string): value is SeverityLevel {
  return (ORDER as readonly string[]).includes(value);
}
