import type { DisasterEvent } from '@/core/events/DisasterEvent';
import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import { StaticGeoDirectory } from '@/core/geo/GeoDirectory';
import { SRI_LANKA_DISTRICTS, SRI_LANKA_RIVER_BASINS } from '@/core/geo/sriLankaGeography';
import { DEFAULT_HAZARD_TYPES, HazardTypeRegistry } from '@/core/hazard/HazardType';
import { InboxService, type InboxMessage } from '@/core/notifications/Inbox';
import { ControllableClock } from '@/core/shared/Clock';
import { InMemoryErrorLog } from '@/core/shared/ErrorLog';
import { InMemoryEventBus } from '@/core/shared/EventBus';
import { SequentialIdGenerator } from '@/core/shared/IdGenerator';
import { InMemoryRepository } from '@/core/shared/Repository';
import { SimulatedConnectivity } from '@/core/sync/Connectivity';
import { SimulatedRemoteSyncGateway } from '@/core/sync/SimulatedRemoteSyncGateway';
import { SyncService, type PendingSyncItem } from '@/core/sync/SyncService';
import type { UserAccount } from '@/core/users/UserAccount';
import { RepositoryUserDirectory } from '@/core/users/UserDirectory';
import { AlertBroadcaster } from '@/modules/alerts/application/AlertBroadcaster';
import { AlertDraftValidator } from '@/modules/alerts/application/AlertDraft';
import { AlertService } from '@/modules/alerts/application/AlertService';
import { AlertMessageFormatter } from '@/modules/alerts/channels/AlertMessageFormatter';
import { SeverityBasedChannelPolicy } from '@/modules/alerts/channels/ChannelSelectionPolicy';
import { PushNotificationChannel } from '@/modules/alerts/channels/PushNotificationChannel';
import { SimulatedSmsGateway, SmsChannel } from '@/modules/alerts/channels/SmsChannel';
import type { DeliveryRecord } from '@/modules/alerts/domain/DeliveryRecord';
import type { HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import { DisasterReportGenerator } from '@/modules/analytics/application/DisasterReportGenerator';
import { DmcOfficialAccessPolicy, DonorAccessPolicy } from '@/modules/analytics/application/ReportAccessPolicy';
import { CsvReportExporter, JsonReportExporter, type ReportExporter } from '@/modules/analytics/application/ReportExporter';
import {
  AlertTimelineBuilder,
  CitizensReachedBuilder,
  RescueOperationsBuilder,
  ResourceDistributionBuilder,
  ShelterOccupancyBuilder,
} from '@/modules/analytics/application/SectionBuilders';
import {
  AlertRepositorySource,
  DeliveryRepositorySource,
  DistributionRepositorySource,
  OccupancyRepositorySource,
  RescueRepositorySource,
} from '@/modules/analytics/infrastructure/RepositoryDataSources';
import { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';
import { OperationalOverviewService } from '@/modules/shelters/application/OperationalOverviewService';
import { ReliefDistributionService } from '@/modules/dispatch/application/ReliefDistributionService';
import { RescueDispatchService } from '@/modules/dispatch/application/RescueDispatchService';
import { ShelterCoordinationService } from '@/modules/shelters/application/ShelterCoordinationService';
import type { ReliefDistribution, ReliefStock } from '@/modules/dispatch/domain/Relief';
import type { OccupancySnapshot } from '@/modules/shelters/domain/OccupancySnapshot';
import type { RescueTeam } from '@/modules/dispatch/domain/RescueTeam';
import { OrganisationDirectory, type ResourceOwner } from '@/core/organisations/ResourceOwner';
import type { Shelter } from '@/modules/shelters/domain/Shelter';
import { SimulatedLocationProvider } from '@/modules/reports/application/LocationProvider';
import { ReportDraftValidator } from '@/modules/reports/application/ReportDraft';
import { ReportNotifier } from '@/modules/reports/application/ReportNotifier';
import { ReportSubmissionService } from '@/modules/reports/application/ReportSubmissionService';
import { ReportVerificationService } from '@/modules/reports/application/ReportVerificationService';
import { PhotoValidator } from '@/modules/reports/domain/Evidence';
import type { GroundReport } from '@/modules/reports/domain/GroundReport';

/**
 * Composition root: the single place where concrete classes are chosen and
 * wired together (Dependency Injection). Every service receives abstractions,
 * so tests can build the same graph with fakes.
 */
export function createSafeZone() {
  const clock = new ControllableClock();
  const ids = new SequentialIdGenerator();
  const events = new InMemoryEventBus();
  const errorLog = new InMemoryErrorLog();
  const connectivity = new SimulatedConnectivity(true);
  const remoteServer = new SimulatedRemoteSyncGateway();
  const smsGateway = new SimulatedSmsGateway();
  // Default simulated GPS position: Kaduwela, Colombo District.
  const gps = new SimulatedLocationProvider({ latitude: 6.9333, longitude: 79.9833 });
  const geo: GeoDirectory = new StaticGeoDirectory(SRI_LANKA_DISTRICTS, SRI_LANKA_RIVER_BASINS);
  const hazardTypes = new HazardTypeRegistry(DEFAULT_HAZARD_TYPES);

  const repositories = {
    users: new InMemoryRepository<UserAccount>(),
    inbox: new InMemoryRepository<InboxMessage>(),
    outbox: new InMemoryRepository<PendingSyncItem>(),
    events: new InMemoryRepository<DisasterEvent>(),
    alerts: new InMemoryRepository<HazardAlert>(),
    deliveries: new InMemoryRepository<DeliveryRecord>(),
    groundReports: new InMemoryRepository<GroundReport>(),
    owners: new InMemoryRepository<ResourceOwner>(),
    shelters: new InMemoryRepository<Shelter>(),
    occupancy: new InMemoryRepository<OccupancySnapshot>(),
    teams: new InMemoryRepository<RescueTeam>(),
    stocks: new InMemoryRepository<ReliefStock>(),
    distributions: new InMemoryRepository<ReliefDistribution>(),
  };

  const users = new RepositoryUserDirectory(repositories.users);
  const inbox = new InboxService(repositories.inbox, ids, clock);
  const sync = new SyncService(repositories.outbox, remoteServer, connectivity, ids, clock, events);

  // UC02 - Submit & Verify Hazard Report
  const reportNotifier = new ReportNotifier(inbox, users, hazardTypes, geo);
  const reportVerification = new ReportVerificationService(repositories.groundReports, reportNotifier, clock, events);
  const reportSubmission = new ReportSubmissionService({
    reports: repositories.groundReports,
    validator: new ReportDraftValidator(hazardTypes),
    photoValidator: new PhotoValidator(),
    locationProvider: gps,
    connectivity,
    sync,
    notifier: reportNotifier,
    geo,
    ids,
    clock,
    events,
  });

  // UC01 - Issue Hazard Warning
  const policy = new SeverityBasedChannelPolicy();
  const broadcaster = new AlertBroadcaster(
    [new PushNotificationChannel(inbox, connectivity), new SmsChannel(smsGateway)],
    policy,
    new AlertMessageFormatter(geo, hazardTypes),
    repositories.deliveries,
    users,
    ids,
    clock,
  );
  const alerts = new AlertService({
    alerts: repositories.alerts,
    validator: new AlertDraftValidator(hazardTypes),
    broadcaster,
    policy,
    users,
    verifiedReports: reportVerification,
    geo,
    hazardTypes,
    ids,
    clock,
    events,
    errorLog,
  });

  // Shared by UC03 and UC04: owner organisations and offline field updates
  const organisations = new OrganisationDirectory(repositories.owners);
  const fieldUpdates = new FieldUpdateRecorder(connectivity, sync, events, clock);

  // UC03 - Coordinate Emergency Shelters
  const shelters = new ShelterCoordinationService(repositories.shelters, repositories.occupancy, fieldUpdates, inbox, users, geo, ids, clock);
  const overview = new OperationalOverviewService(repositories.events, repositories.shelters, repositories.teams, repositories.distributions, clock);

  // UC04 - Dispatch Rescue Teams & Relief Resources
  const rescue = new RescueDispatchService(repositories.teams, fieldUpdates, inbox, users, geo, clock);
  const relief = new ReliefDistributionService(
    repositories.stocks,
    organisations,
    repositories.distributions,
    repositories.shelters,
    fieldUpdates,
    ids,
    clock,
  );

  // UC05 - Generate Disaster Response Reports
  const alertSource = new AlertRepositorySource(repositories.alerts, geo);
  const reportGenerator = new DisasterReportGenerator(
    [
      new AlertTimelineBuilder(alertSource),
      new CitizensReachedBuilder(alertSource, new DeliveryRepositorySource(repositories.deliveries)),
      new ShelterOccupancyBuilder(new OccupancyRepositorySource(repositories.occupancy, repositories.shelters)),
      new ResourceDistributionBuilder(new DistributionRepositorySource(repositories.distributions, repositories.owners)),
      new RescueOperationsBuilder(new RescueRepositorySource(repositories.teams, organisations)),
    ],
    [new DmcOfficialAccessPolicy(), new DonorAccessPolicy()],
    repositories.events,
    geo,
    ids,
    clock,
    errorLog,
  );
  const exporters: readonly ReportExporter[] = [new CsvReportExporter(), new JsonReportExporter()];

  sync.registerHandler(reportSubmission);
  sync.registerHandler(fieldUpdates);
  const stopAutoSync = sync.startAutoSync();
  const stopAlertRetry = connectivity.onChange((online) => {
    if (online) void alerts.retryQueuedDeliveries();
  });

  return {
    clock,
    ids,
    events,
    errorLog,
    connectivity,
    remoteServer,
    smsGateway,
    gps,
    geo,
    hazardTypes,
    repositories,
    users,
    inbox,
    sync,
    organisations,
    alerts,
    reportSubmission,
    reportVerification,
    shelters,
    rescue,
    relief,
    overview,
    reportGenerator,
    exporters,
    dispose(): void {
      stopAutoSync();
      stopAlertRetry();
    },
  };
}

export type SafeZoneApp = ReturnType<typeof createSafeZone>;
