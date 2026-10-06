import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { Repository } from '@/core/shared/Repository';
import { DeliveryStatus, type DeliveryRecord } from '@/modules/alerts/domain/DeliveryRecord';
import { AlertStatus, type HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import type { ReliefDistribution } from '@/modules/dispatch/domain/Relief';
import type { OccupancySnapshot } from '@/modules/shelters/domain/OccupancySnapshot';
import type { RescueTeam } from '@/modules/dispatch/domain/RescueTeam';
import type { OrganisationDirectory } from '@/core/organisations/ResourceOwner';
import type { ResourceOwner } from '@/core/organisations/ResourceOwner';
import type { Shelter } from '@/modules/shelters/domain/Shelter';
import type {
  AlertFact,
  AlertHistorySource,
  DeliveryFact,
  DeliveryStatisticsSource,
  DistributionFact,
  DistributionHistorySource,
  OccupancyFact,
  OccupancyHistorySource,
  RescueHistorySource,
  RescueMissionFact,
} from '../application/DataSources';

/*
 * Adapters that translate other modules' entities into reporting facts. They
 * are the only place UC05 knows about UC01, UC03 and UC04 classes.
 */

export class AlertRepositorySource implements AlertHistorySource {
  constructor(
    private readonly alertRepository: Repository<HazardAlert>,
    private readonly geo: GeoDirectory,
  ) {}

  alerts(): AlertFact[] {
    return this.alertRepository
      .findWhere((alert) => alert.status !== AlertStatus.DRAFT && alert.issuedAt !== undefined)
      .map((alert) => ({
        alertId: alert.id,
        title: alert.title,
        severity: alert.severity,
        initialSeverity: alert.escalations[0]?.from ?? alert.severity,
        eventId: alert.eventId,
        districtIds: alert.target.resolveDistrictIds(this.geo),
        issuedAt: alert.issuedAt as Date,
        resolvedAt: alert.resolvedAt,
        escalations: alert.escalations.map((e) => ({ at: e.at, to: e.to, reason: e.reason })),
      }));
  }
}

export class DeliveryRepositorySource implements DeliveryStatisticsSource {
  constructor(private readonly deliveries: Repository<DeliveryRecord>) {}

  deliveriesFor(alertIds: readonly string[]): DeliveryFact[] {
    const wanted = new Set(alertIds);
    return this.deliveries
      .findWhere((record) => wanted.has(record.alertId))
      .map((record) => ({
        alertId: record.alertId,
        recipientId: record.recipientId,
        districtId: record.districtId,
        channel: record.channel,
        delivered: record.status === DeliveryStatus.DELIVERED,
      }));
  }
}

export class OccupancyRepositorySource implements OccupancyHistorySource {
  constructor(
    private readonly snapshotRepository: Repository<OccupancySnapshot>,
    private readonly shelters: Repository<Shelter>,
  ) {}

  snapshots(): OccupancyFact[] {
    return this.snapshotRepository.findAll().map((snapshot) => ({
      shelterId: snapshot.shelterId,
      shelterName: this.shelters.findById(snapshot.shelterId)?.name ?? snapshot.shelterId,
      districtId: snapshot.districtId,
      occupancy: snapshot.occupancy,
      capacity: snapshot.capacity,
      at: snapshot.at,
    }));
  }
}

export class DistributionRepositorySource implements DistributionHistorySource {
  constructor(
    private readonly distributionRepository: Repository<ReliefDistribution>,
    private readonly owners: Repository<ResourceOwner>,
  ) {}

  distributions(): DistributionFact[] {
    return this.distributionRepository.findAll().map((d) => {
      const owner = this.owners.findById(d.ownerId);
      return {
        districtId: d.districtId,
        ownerId: d.ownerId,
        ownerName: owner?.name ?? d.ownerId,
        ownerType: owner?.type ?? 'UNKNOWN',
        category: d.category,
        itemName: d.itemName,
        unit: d.unit,
        quantity: d.quantity,
        eventId: d.eventId,
        at: d.distributedAt,
      };
    });
  }
}

export class RescueRepositorySource implements RescueHistorySource {
  constructor(
    private readonly teams: Repository<RescueTeam>,
    private readonly organisations: OrganisationDirectory,
  ) {}

  missions(): RescueMissionFact[] {
    return this.teams.findAll().flatMap((team) =>
      team.missions.map((mission) => ({
        teamId: team.id,
        teamName: team.name,
        ownerName: this.organisations.get(team.ownerId).name,
        districtId: mission.assignment.districtId,
        eventId: mission.assignment.eventId,
        dispatchedAt: mission.assignment.assignedAt,
        onSceneAt: mission.onSceneAt,
        completedAt: mission.completedAt,
        peopleRescued: mission.peopleRescued,
        crossOrganisation: mission.assignment.crossOrganisation,
      })),
    );
  }
}
