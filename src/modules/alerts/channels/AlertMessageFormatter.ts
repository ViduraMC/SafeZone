import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { HazardTypeRegistry } from '@/core/hazard/HazardType';
import type { HazardAlert } from '../domain/HazardAlert';
import type { AlertContent } from './NotificationChannel';

export const SMS_MAX_LENGTH = 160;

/** Builds the human-readable alert text once, so channels only transport it. */
export class AlertMessageFormatter {
  constructor(
    private readonly geo: GeoDirectory,
    private readonly hazardTypes: HazardTypeRegistry,
  ) {}

  format(alert: HazardAlert, isUpdate = false): AlertContent {
    const hazard = this.hazardTypes.get(alert.hazardTypeCode).name;
    const area = alert.target.describe(this.geo);
    const prefix = isUpdate ? `UPDATED ${alert.severity}` : alert.severity;
    const title = `${prefix}: ${alert.title}`;
    const body = `${hazard} - ${area}. ${alert.description}`;
    return {
      alertId: alert.id,
      severity: alert.severity,
      title,
      body,
      shortText: truncate(`SafeZone ${prefix} ${hazard} (${area}): ${alert.description}`, SMS_MAX_LENGTH),
    };
  }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}
