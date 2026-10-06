/**
 * A disaster event groups alerts, reports and response activity
 * (e.g. "Kelani Basin Floods - May 2026"). It was missing from the original
 * class diagram even though UC03 and UC04 both start with "select disaster event".
 */
export interface DisasterEvent {
  readonly id: string;
  readonly name: string;
  readonly hazardTypeCode: string;
  readonly districtIds: readonly string[];
  readonly startedAt: Date;
  readonly endedAt?: Date;
}

export function isEventOngoing(event: DisasterEvent, at: Date): boolean {
  return event.startedAt <= at && (!event.endedAt || event.endedAt >= at);
}
