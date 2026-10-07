import { ValidationError } from '@/core/shared/errors';

export enum ReportCategory {
  ALERT_TIMELINE = 'ALERT_TIMELINE',
  CITIZENS_REACHED = 'CITIZENS_REACHED',
  SHELTER_OCCUPANCY = 'SHELTER_OCCUPANCY',
  RESOURCE_DISTRIBUTION = 'RESOURCE_DISTRIBUTION',
  RESCUE_OPERATIONS = 'RESCUE_OPERATIONS',
}

export const REPORT_CATEGORY_LABELS: Readonly<Record<ReportCategory, string>> = {
  [ReportCategory.ALERT_TIMELINE]: 'Alert Timeline',
  [ReportCategory.CITIZENS_REACHED]: 'Citizens Reached',
  [ReportCategory.SHELTER_OCCUPANCY]: 'Shelter Occupancy',
  [ReportCategory.RESOURCE_DISTRIBUTION]: 'Resource Distribution',
  [ReportCategory.RESCUE_OPERATIONS]: 'Rescue Operations',
};

export const MAX_PERIOD_DAYS = 366;
const MS_PER_DAY = 86_400_000;

/** Reporting window. Construction validates the range (UC05 E2 "Invalid Reporting Period"). */
export class ReportingPeriod {
  private constructor(
    readonly from: Date,
    readonly to: Date,
  ) {}

  static of(from: Date, to: Date, now: Date): ReportingPeriod {
    const error = (message: string) => new ValidationError({ period: message });
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw error('Enter both a start and an end date');
    if (from >= to) throw error('The start date must be before the end date');
    if (from > now) throw error('The reporting period cannot start in the future');
    if ((to.getTime() - from.getTime()) / MS_PER_DAY > MAX_PERIOD_DAYS) {
      throw error(`The reporting period cannot exceed ${MAX_PERIOD_DAYS} days`);
    }
    return new ReportingPeriod(from, to);
  }

  contains(at: Date): boolean {
    return at >= this.from && at <= this.to;
  }

  overlaps(start: Date, end: Date | undefined): boolean {
    return start <= this.to && (end === undefined || end >= this.from);
  }
}

/** What the user asked for on the report filter screen (UC05 steps 3-7). */
export interface ReportCriteria {
  readonly eventId: string;
  readonly categories: readonly ReportCategory[];
  /** Empty means "all districts affected by the event". */
  readonly districtIds: readonly string[];
  readonly period: ReportingPeriod;
}
