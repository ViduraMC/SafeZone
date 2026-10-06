import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { Clock } from '@/core/shared/Clock';
import { AuthorizationError, NotFoundError } from '@/core/shared/errors';
import type { EventBus } from '@/core/shared/EventBus';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import type { ConnectivityMonitor } from '@/core/sync/Connectivity';
import type { PendingSyncItem, SyncHandler, SyncService } from '@/core/sync/SyncService';
import { hasRole, Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { Evidence, PhotoValidator } from '../domain/Evidence';
import { GroundReport, type SeverityAssessment } from '../domain/GroundReport';
import { locationFromGps, locationFromManualEntry, type ReportLocation } from '../domain/ReportLocation';
import type { LocationProvider } from './LocationProvider';
import type { ReportDraft, ReportDraftValidator } from './ReportDraft';
import type { ReportNotifier } from './ReportNotifier';

export const REPORT_SYNC_KIND = 'ground-report';
export const REPORT_EVENTS = {
  submitted: 'report.submitted',
  reviewed: 'report.reviewed',
  synced: 'report.synced',
} as const;

export interface SubmissionDependencies {
  readonly reports: Repository<GroundReport>;
  readonly validator: ReportDraftValidator;
  readonly photoValidator: PhotoValidator;
  readonly locationProvider: LocationProvider;
  readonly connectivity: ConnectivityMonitor;
  readonly sync: SyncService;
  readonly notifier: ReportNotifier;
  readonly geo: GeoDirectory;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: EventBus;
}

/** Reporter side of UC02: capture, submit (online or offline) and follow-up. */
export class ReportSubmissionService implements SyncHandler {
  readonly kind = REPORT_SYNC_KIND;

  constructor(private readonly deps: SubmissionDependencies) {}

  /** Step 6 / E1: obtain GPS location; throws LocationUnavailableError when GPS is off. */
  async detectLocation(): Promise<ReportLocation> {
    const position = await this.deps.locationProvider.currentPosition();
    return locationFromGps(position, this.deps.geo);
  }

  manualLocation(districtId: string, placeDescription: string): ReportLocation {
    return locationFromManualEntry(districtId, placeDescription, this.deps.geo);
  }

  /** Step 5 / E4: validates a captured photo and wraps it as evidence. */
  attachPhoto(photo: Omit<Evidence, 'id'>): Evidence {
    this.deps.photoValidator.validate(photo);
    return { ...photo, id: this.deps.ids.next('PHOTO') };
  }

  submit(draft: ReportDraft, reporter: UserAccount): GroundReport {
    requireRole(reporter, Role.CITIZEN, Role.VOLUNTEER);
    this.deps.validator.validate(draft);

    const offline = !this.deps.connectivity.isOnline();
    const report = GroundReport.submit(
      {
        id: this.deps.ids.next('RPT'),
        reporterId: reporter.id,
        reporterKind: hasRole(reporter, Role.VOLUNTEER) ? 'VOLUNTEER' : 'CITIZEN',
        hazardTypeCode: draft.hazardTypeCode,
        description: draft.description.trim(),
        severityAssessment: draft.severityAssessment as SeverityAssessment,
        location: draft.location as ReportLocation,
        evidence: draft.photos,
        submittedAt: this.deps.clock.now(),
      },
      offline,
    );
    this.deps.reports.save(report);

    if (offline) {
      this.deps.sync.enqueue(REPORT_SYNC_KIND, report.id, `Hazard report ${report.id}`);
    } else {
      this.deps.notifier.notifyDutyOfficers(report);
    }
    this.publish(REPORT_EVENTS.submitted, report);
    return report;
  }

  /** A1: reporter supplies information requested by the duty officer. */
  provideAdditionalInformation(reportId: string, reporter: UserAccount, text: string, photos: readonly Evidence[] = []): GroundReport {
    const report = this.getReport(reportId);
    if (report.reporterId !== reporter.id) {
      throw new AuthorizationError('Only the original reporter can update this report');
    }
    report.supplement(text, photos, this.deps.clock.now());
    this.deps.reports.save(report);
    this.deps.notifier.notifyDutyOfficers(report, true);
    this.publish(REPORT_EVENTS.submitted, report);
    return report;
  }

  myReports(reporterId: string): GroundReport[] {
    return this.deps.reports
      .findWhere((report) => report.reporterId === reporterId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  getReport(reportId: string): GroundReport {
    const report = this.deps.reports.findById(reportId);
    if (!report) throw new NotFoundError('Ground report', reportId);
    return report;
  }

  /** SyncHandler: an offline report reached the server, so it enters the review queue. */
  onSynced(item: PendingSyncItem): void {
    const report = this.getReport(item.entityId);
    report.markSynced(this.deps.clock.now());
    this.deps.reports.save(report);
    this.deps.notifier.notifyDutyOfficers(report);
    this.publish(REPORT_EVENTS.synced, report);
  }

  private publish(type: string, report: GroundReport): void {
    this.deps.events.publish({ type, occurredAt: this.deps.clock.now(), payload: { reportId: report.id, status: report.status } });
  }
}
