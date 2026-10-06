import type { SeverityLevel } from '@/core/hazard/SeverityLevel';

/*
 * Narrow, read-only data ports for reporting (Interface Segregation and
 * Dependency Inversion fix). The original AnalysisReport depended on the full
 * HazardAlert, Shelter and ReliefSupply classes and queried each directly; the
 * generator now sees only the facts it needs, supplied by adapters.
 */

export interface AlertFact {
  readonly alertId: string;
  readonly title: string;
  readonly severity: SeverityLevel;
  readonly initialSeverity: SeverityLevel;
  readonly eventId?: string;
  readonly districtIds: readonly string[];
  readonly issuedAt: Date;
  readonly resolvedAt?: Date;
  readonly escalations: readonly { readonly at: Date; readonly to: SeverityLevel; readonly reason: string }[];
}

export interface DeliveryFact {
  readonly alertId: string;
  readonly recipientId: string;
  readonly districtId: string;
  readonly channel: string;
  readonly delivered: boolean;
}

export interface OccupancyFact {
  readonly shelterId: string;
  readonly shelterName: string;
  readonly districtId: string;
  readonly occupancy: number;
  readonly capacity: number;
  readonly at: Date;
}

export interface DistributionFact {
  readonly districtId: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerType: string;
  readonly category: string;
  readonly itemName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly eventId?: string;
  readonly at: Date;
}

export interface RescueMissionFact {
  readonly teamId: string;
  readonly teamName: string;
  readonly ownerName: string;
  readonly districtId: string;
  readonly eventId?: string;
  readonly dispatchedAt: Date;
  readonly onSceneAt?: Date;
  readonly completedAt: Date;
  readonly peopleRescued: number;
  readonly crossOrganisation: boolean;
}

export interface AlertHistorySource {
  alerts(): readonly AlertFact[];
}

export interface DeliveryStatisticsSource {
  deliveriesFor(alertIds: readonly string[]): readonly DeliveryFact[];
}

export interface OccupancyHistorySource {
  snapshots(): readonly OccupancyFact[];
}

export interface DistributionHistorySource {
  distributions(): readonly DistributionFact[];
}

export interface RescueHistorySource {
  missions(): readonly RescueMissionFact[];
}
