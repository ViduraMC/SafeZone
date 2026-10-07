import type { SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { ReportCategory } from './ReportCriteria';

export interface TimelineEntry {
  readonly at: Date;
  readonly alertId: string;
  readonly title: string;
  readonly severity: SeverityLevel;
  readonly action: 'ISSUED' | 'ESCALATED' | 'RESOLVED';
  readonly districtIds: readonly string[];
  readonly note?: string;
}

export interface AlertTimelineSection {
  readonly category: ReportCategory.ALERT_TIMELINE;
  readonly hasData: boolean;
  readonly entries: readonly TimelineEntry[];
  readonly totals: { readonly issued: number; readonly escalated: number; readonly resolved: number };
}

export interface DistrictReach {
  readonly districtId: string;
  readonly targeted: number;
  readonly reached: number;
}

export interface CitizensReachedSection {
  readonly category: ReportCategory.CITIZENS_REACHED;
  readonly hasData: boolean;
  readonly targeted: number;
  readonly reached: number;
  readonly reachRate: number;
  readonly deliveriesByChannel: Readonly<Record<string, number>>;
  readonly byDistrict: readonly DistrictReach[];
}

export interface OccupancyPoint {
  readonly at: Date;
  readonly occupancy: number;
}

export interface ShelterSeries {
  readonly shelterId: string;
  readonly shelterName: string;
  readonly districtId: string;
  readonly capacity: number;
  readonly points: readonly OccupancyPoint[];
  readonly peakOccupancy: number;
}

export interface ShelterOccupancySection {
  readonly category: ReportCategory.SHELTER_OCCUPANCY;
  readonly hasData: boolean;
  readonly shelters: readonly ShelterSeries[];
  readonly totalCapacity: number;
  readonly peakTotalOccupancy: number;
  readonly peakUtilisation: number;
}

export interface DistributionRow {
  readonly districtId: string;
  readonly category: string;
  readonly itemName: string;
  readonly unit: string;
  readonly ownerName: string;
  readonly quantity: number;
}

export interface OwnerContribution {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerType: string;
  readonly quantity: number;
}

export interface ResourceDistributionSection {
  readonly category: ReportCategory.RESOURCE_DISTRIBUTION;
  readonly hasData: boolean;
  readonly rows: readonly DistributionRow[];
  readonly totalsByDistrict: Readonly<Record<string, number>>;
  readonly totalsByCategory: Readonly<Record<string, number>>;
  readonly byOwner: readonly OwnerContribution[];
  /** Set when the report is restricted to one donor's contributions (A3). */
  readonly restrictedToOwnerId?: string;
}

export interface TeamPerformance {
  readonly teamName: string;
  readonly ownerName: string;
  readonly missions: number;
  readonly peopleRescued: number;
}

export interface RescueOperationsSection {
  readonly category: ReportCategory.RESCUE_OPERATIONS;
  readonly hasData: boolean;
  readonly missions: number;
  readonly peopleRescued: number;
  /** Average minutes from dispatch to arrival on scene; undefined when no arrival was recorded. */
  readonly averageResponseMinutes?: number;
  readonly crossOrganisationMissions: number;
  readonly byTeam: readonly TeamPerformance[];
}

export type ReportSection =
  | AlertTimelineSection
  | CitizensReachedSection
  | ShelterOccupancySection
  | ResourceDistributionSection
  | RescueOperationsSection;

export interface DisasterResponseReport {
  readonly id: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly districtIds: readonly string[];
  readonly periodFrom: Date;
  readonly periodTo: Date;
  readonly generatedAt: Date;
  readonly generatedBy: string;
  readonly sections: readonly ReportSection[];
  /** E1: data gaps the reader should know about. */
  readonly notices: readonly string[];
}
