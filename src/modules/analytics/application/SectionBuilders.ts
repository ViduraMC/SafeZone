import { ReportCategory, type ReportingPeriod } from '../domain/ReportCriteria';
import type {
  AlertTimelineSection,
  CitizensReachedSection,
  DistributionRow,
  OwnerContribution,
  ReportSection,
  RescueOperationsSection,
  ResourceDistributionSection,
  ShelterOccupancySection,
  TeamPerformance,
  ShelterSeries,
  TimelineEntry,
} from '../domain/ReportSections';
import type {
  AlertFact,
  AlertHistorySource,
  DeliveryStatisticsSource,
  DistributionHistorySource,
  OccupancyFact,
  OccupancyHistorySource,
  RescueHistorySource,
} from './DataSources';

/** Everything a section needs to know about the request, already validated and scoped. */
export interface SectionContext {
  readonly eventId: string;
  readonly districtIds: readonly string[];
  readonly period: ReportingPeriod;
  /** Restricts resource data to one owner organisation (donor-specific report, A3). */
  readonly ownerId?: string;
}

/**
 * Strategy for one report category (Open/Closed + Single Responsibility fix for
 * the AnalysisReport "god class"). New report categories are added by
 * registering another builder with the generator.
 */
export interface ReportSectionBuilder {
  readonly category: ReportCategory;
  build(context: SectionContext): ReportSection;
}

/** Alerts that belong to the event (or are untagged), touch the districts and overlap the period. */
function selectAlerts(source: AlertHistorySource, ctx: SectionContext): AlertFact[] {
  const districts = new Set(ctx.districtIds);
  return source
    .alerts()
    .filter((a) => a.eventId === undefined || a.eventId === ctx.eventId)
    .filter((a) => a.districtIds.some((id) => districts.has(id)))
    .filter((a) => ctx.period.overlaps(a.issuedAt, a.resolvedAt));
}

export class AlertTimelineBuilder implements ReportSectionBuilder {
  readonly category = ReportCategory.ALERT_TIMELINE;

  constructor(private readonly alerts: AlertHistorySource) {}

  build(ctx: SectionContext): AlertTimelineSection {
    const entries: TimelineEntry[] = [];
    for (const alert of selectAlerts(this.alerts, ctx)) {
      const base = { alertId: alert.alertId, title: alert.title, districtIds: alert.districtIds };
      if (ctx.period.contains(alert.issuedAt)) {
        entries.push({ ...base, at: alert.issuedAt, severity: alert.initialSeverity, action: 'ISSUED' });
      }
      alert.escalations
        .filter((e) => ctx.period.contains(e.at))
        .forEach((e) => entries.push({ ...base, at: e.at, severity: e.to, action: 'ESCALATED', note: e.reason }));
      if (alert.resolvedAt && ctx.period.contains(alert.resolvedAt)) {
        entries.push({ ...base, at: alert.resolvedAt, severity: alert.severity, action: 'RESOLVED' });
      }
    }
    entries.sort((a, b) => a.at.getTime() - b.at.getTime());
    const count = (action: TimelineEntry['action']) => entries.filter((e) => e.action === action).length;
    return {
      category: ReportCategory.ALERT_TIMELINE,
      hasData: entries.length > 0,
      entries,
      totals: { issued: count('ISSUED'), escalated: count('ESCALATED'), resolved: count('RESOLVED') },
    };
  }
}

export class CitizensReachedBuilder implements ReportSectionBuilder {
  readonly category = ReportCategory.CITIZENS_REACHED;

  constructor(
    private readonly alerts: AlertHistorySource,
    private readonly deliveries: DeliveryStatisticsSource,
  ) {}

  build(ctx: SectionContext): CitizensReachedSection {
    const alertIds = selectAlerts(this.alerts, ctx).map((a) => a.alertId);
    const districts = new Set(ctx.districtIds);
    const facts = this.deliveries.deliveriesFor(alertIds).filter((d) => districts.has(d.districtId));

    const targeted = new Map<string, string>();
    const reached = new Set<string>();
    const deliveriesByChannel: Record<string, number> = {};
    for (const fact of facts) {
      targeted.set(fact.recipientId, fact.districtId);
      if (fact.delivered) {
        reached.add(fact.recipientId);
        deliveriesByChannel[fact.channel] = (deliveriesByChannel[fact.channel] ?? 0) + 1;
      }
    }

    const byDistrict = ctx.districtIds.map((districtId) => {
      const recipients = [...targeted].filter(([, d]) => d === districtId).map(([id]) => id);
      return { districtId, targeted: recipients.length, reached: recipients.filter((id) => reached.has(id)).length };
    });

    return {
      category: ReportCategory.CITIZENS_REACHED,
      hasData: targeted.size > 0,
      targeted: targeted.size,
      reached: reached.size,
      reachRate: targeted.size === 0 ? 0 : reached.size / targeted.size,
      deliveriesByChannel,
      byDistrict,
    };
  }
}

export class ShelterOccupancyBuilder implements ReportSectionBuilder {
  readonly category = ReportCategory.SHELTER_OCCUPANCY;

  constructor(private readonly occupancy: OccupancyHistorySource) {}

  build(ctx: SectionContext): ShelterOccupancySection {
    const districts = new Set(ctx.districtIds);
    const byShelter = new Map<string, OccupancyFact[]>();
    this.occupancy
      .snapshots()
      .filter((s) => districts.has(s.districtId) && s.at <= ctx.period.to)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .forEach((s) => byShelter.set(s.shelterId, [...(byShelter.get(s.shelterId) ?? []), s]));

    const shelters: ShelterSeries[] = [];
    for (const snapshots of byShelter.values()) {
      const series = this.seriesWithinPeriod(snapshots, ctx.period);
      if (series) shelters.push(series);
    }

    const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
    const peakTotalOccupancy = peakOfTotals(shelters);
    return {
      category: ReportCategory.SHELTER_OCCUPANCY,
      hasData: shelters.some((s) => s.points.length > 0),
      shelters,
      totalCapacity,
      peakTotalOccupancy,
      peakUtilisation: totalCapacity === 0 ? 0 : peakTotalOccupancy / totalCapacity,
    };
  }

  /** Points inside the period, starting from the occupancy carried in from before it. */
  private seriesWithinPeriod(snapshots: OccupancyFact[], period: ReportingPeriod): ShelterSeries | undefined {
    const before = snapshots.filter((s) => s.at < period.from);
    const inside = snapshots.filter((s) => period.contains(s.at));
    const baseline = before[before.length - 1];
    const points = [
      ...(baseline ? [{ at: period.from, occupancy: baseline.occupancy }] : []),
      ...inside.map((s) => ({ at: s.at, occupancy: s.occupancy })),
    ];
    if (points.length === 0) return undefined;
    const latest = snapshots[snapshots.length - 1];
    return {
      shelterId: latest.shelterId,
      shelterName: latest.shelterName,
      districtId: latest.districtId,
      capacity: latest.capacity,
      points,
      peakOccupancy: Math.max(...points.map((p) => p.occupancy)),
    };
  }
}

/** Highest combined occupancy across all shelters at any recorded moment. */
function peakOfTotals(shelters: readonly ShelterSeries[]): number {
  const timeline = shelters
    .flatMap((s) => s.points.map((p) => ({ shelterId: s.shelterId, ...p })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const current = new Map<string, number>();
  let peak = 0;
  for (const point of timeline) {
    current.set(point.shelterId, point.occupancy);
    peak = Math.max(peak, [...current.values()].reduce((sum, value) => sum + value, 0));
  }
  return peak;
}

export class ResourceDistributionBuilder implements ReportSectionBuilder {
  readonly category = ReportCategory.RESOURCE_DISTRIBUTION;

  constructor(private readonly distributions: DistributionHistorySource) {}

  build(ctx: SectionContext): ResourceDistributionSection {
    const districts = new Set(ctx.districtIds);
    const facts = this.distributions
      .distributions()
      .filter((d) => districts.has(d.districtId) && ctx.period.contains(d.at))
      .filter((d) => d.eventId === undefined || d.eventId === ctx.eventId)
      .filter((d) => !ctx.ownerId || d.ownerId === ctx.ownerId);

    const rows = new Map<string, DistributionRow>();
    const owners = new Map<string, OwnerContribution>();
    const totalsByDistrict: Record<string, number> = {};
    const totalsByCategory: Record<string, number> = {};

    for (const fact of facts) {
      const key = [fact.districtId, fact.category, fact.itemName, fact.ownerId].join('|');
      const row = rows.get(key);
      rows.set(key, {
        districtId: fact.districtId,
        category: fact.category,
        itemName: fact.itemName,
        unit: fact.unit,
        ownerName: fact.ownerName,
        quantity: (row?.quantity ?? 0) + fact.quantity,
      });
      const owner = owners.get(fact.ownerId);
      owners.set(fact.ownerId, {
        ownerId: fact.ownerId,
        ownerName: fact.ownerName,
        ownerType: fact.ownerType,
        quantity: (owner?.quantity ?? 0) + fact.quantity,
      });
      totalsByDistrict[fact.districtId] = (totalsByDistrict[fact.districtId] ?? 0) + fact.quantity;
      totalsByCategory[fact.category] = (totalsByCategory[fact.category] ?? 0) + fact.quantity;
    }

    return {
      category: ReportCategory.RESOURCE_DISTRIBUTION,
      hasData: facts.length > 0,
      rows: [...rows.values()].sort((a, b) => a.districtId.localeCompare(b.districtId) || b.quantity - a.quantity),
      totalsByDistrict,
      totalsByCategory,
      byOwner: [...owners.values()].sort((a, b) => b.quantity - a.quantity),
      restrictedToOwnerId: ctx.ownerId,
    };
  }
}

const MS_PER_MINUTE = 60_000;

/** Rescue missions completed in the period (the original UC04 sequence collected "rescue statistics"). */
export class RescueOperationsBuilder implements ReportSectionBuilder {
  readonly category = ReportCategory.RESCUE_OPERATIONS;

  constructor(private readonly rescues: RescueHistorySource) {}

  build(ctx: SectionContext): RescueOperationsSection {
    const districts = new Set(ctx.districtIds);
    const missions = this.rescues
      .missions()
      .filter((m) => districts.has(m.districtId) && ctx.period.contains(m.completedAt))
      .filter((m) => m.eventId === undefined || m.eventId === ctx.eventId);

    const responseTimes = missions
      .filter((m) => m.onSceneAt !== undefined)
      .map((m) => ((m.onSceneAt as Date).getTime() - m.dispatchedAt.getTime()) / MS_PER_MINUTE);
    const byTeam = new Map<string, TeamPerformance>();
    for (const mission of missions) {
      const current = byTeam.get(mission.teamId);
      byTeam.set(mission.teamId, {
        teamName: mission.teamName,
        ownerName: mission.ownerName,
        missions: (current?.missions ?? 0) + 1,
        peopleRescued: (current?.peopleRescued ?? 0) + mission.peopleRescued,
      });
    }

    return {
      category: ReportCategory.RESCUE_OPERATIONS,
      hasData: missions.length > 0,
      missions: missions.length,
      peopleRescued: missions.reduce((sum, m) => sum + m.peopleRescued, 0),
      averageResponseMinutes:
        responseTimes.length === 0 ? undefined : Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      crossOrganisationMissions: missions.filter((m) => m.crossOrganisation).length,
      byTeam: [...byTeam.values()].sort((a, b) => b.peopleRescued - a.peopleRescued),
    };
  }
}
