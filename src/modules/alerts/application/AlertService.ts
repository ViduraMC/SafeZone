import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { HazardTypeRegistry } from '@/core/hazard/HazardType';
import type { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { addHours, type Clock } from '@/core/shared/Clock';
import { DomainError, NotFoundError, OperationFailedError } from '@/core/shared/errors';
import type { ErrorLog } from '@/core/shared/ErrorLog';
import type { EventBus } from '@/core/shared/EventBus';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import { Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { UserDirectory } from '@/core/users/UserDirectory';
import type { ChannelSelectionPolicy } from '../channels/ChannelSelectionPolicy';
import type { ChannelKind } from '../domain/DeliveryRecord';
import { AlertStatus, HazardAlert } from '../domain/HazardAlert';
import { createTargetArea } from '../domain/TargetArea';
import type { AlertBroadcaster, BroadcastSummary, RetrySummary } from './AlertBroadcaster';
import type { AlertDraft, AlertDraftValidator } from './AlertDraft';
import { summariseDeliveries, type DeliverySummary } from './DeliverySummary';
import type { VerifiedReportFeed, VerifiedReportSummary } from './VerifiedReportFeed';

export const ALERT_EVENTS = {
  issued: 'alert.issued',
  escalated: 'alert.escalated',
  resolved: 'alert.resolved',
} as const;

/** Shown on the review & confirm step (UC01 main flow step 10). */
export interface WarningPreview {
  readonly areaDescription: string;
  readonly districtIds: readonly string[];
  readonly recipientCount: number;
  readonly channels: readonly ChannelKind[];
  readonly audibleOverride: boolean;
  readonly validUntil: Date;
}

export interface WarningResult {
  readonly alert: HazardAlert;
  readonly summary: BroadcastSummary;
  /** UC01 E3: no registered citizens in the area; the warning is still stored. */
  readonly noRecipientsFound: boolean;
}

export interface WarningDashboard {
  readonly activeAlerts: readonly HazardAlert[];
  readonly verifiedReports: readonly VerifiedReportSummary[];
}

export interface AlertServiceDependencies {
  readonly alerts: Repository<HazardAlert>;
  readonly validator: AlertDraftValidator;
  readonly broadcaster: AlertBroadcaster;
  readonly policy: ChannelSelectionPolicy;
  readonly users: UserDirectory;
  readonly verifiedReports: VerifiedReportFeed;
  readonly geo: GeoDirectory;
  readonly hazardTypes: HazardTypeRegistry;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: EventBus;
  readonly errorLog: ErrorLog;
}

/**
 * Application service for UC01 "Issue Hazard Warning". Coordinates validation,
 * targeting, persistence and broadcasting; owns no business rules itself
 * (those live in HazardAlert, TargetArea and the channel policy).
 */
export class AlertService {
  constructor(private readonly deps: AlertServiceDependencies) {}

  dashboard(): WarningDashboard {
    return { activeAlerts: this.listActive(), verifiedReports: this.deps.verifiedReports.listVerified() };
  }

  listActive(): HazardAlert[] {
    const now = this.deps.clock.now();
    return this.sortedNewestFirst(this.deps.alerts.findWhere((alert) => alert.isActiveAt(now)));
  }

  /** Issued warnings that have expired or been resolved. */
  listArchived(): HazardAlert[] {
    const now = this.deps.clock.now();
    return this.sortedNewestFirst(this.deps.alerts.findWhere((alert) => alert.status !== AlertStatus.DRAFT && !alert.isActiveAt(now)));
  }

  /** Alerts for a citizen's district, split into active and archived (Alerts screen). */
  listForDistrict(districtId: string): { active: HazardAlert[]; archived: HazardAlert[] } {
    const now = this.deps.clock.now();
    const relevant = this.deps.alerts.findWhere((alert) =>
      alert.status !== AlertStatus.DRAFT && alert.target.resolveDistrictIds(this.deps.geo).includes(districtId),
    );
    return {
      active: this.sortedNewestFirst(relevant.filter((alert) => alert.isActiveAt(now))),
      archived: this.sortedNewestFirst(relevant.filter((alert) => !alert.isActiveAt(now))),
    };
  }

  getAlert(alertId: string): HazardAlert {
    const alert = this.deps.alerts.findById(alertId);
    if (!alert) throw new NotFoundError('Hazard alert', alertId);
    return alert;
  }

  preview(draft: AlertDraft): WarningPreview {
    this.deps.validator.validate(draft);
    const target = createTargetArea(draft.targetScope, draft.targetIds);
    const districtIds = target.resolveDistrictIds(this.deps.geo);
    const recipients = this.deps.users.findRecipientsInDistricts(districtIds);
    const severity = draft.severity as SeverityLevel;
    const channels = new Set<ChannelKind>();
    recipients.forEach((r) => this.deps.policy.plan(severity, r).channels.forEach((c) => channels.add(c)));
    return {
      areaDescription: target.describe(this.deps.geo),
      districtIds,
      recipientCount: recipients.length,
      channels: [...channels],
      audibleOverride: recipients.length > 0 && this.deps.policy.plan(severity, recipients[0]).audibleOverride,
      validUntil: addHours(this.deps.clock.now(), draft.validityHours),
    };
  }

  async issueWarning(draft: AlertDraft, officer: UserAccount): Promise<WarningResult> {
    requireRole(officer, Role.DMC_OFFICER);
    this.deps.validator.validate(draft);

    const now = this.deps.clock.now();
    const alert = HazardAlert.draft({
      id: this.deps.ids.next('ALT'),
      hazardTypeCode: draft.hazardTypeCode,
      title: draft.title.trim(),
      description: draft.description.trim(),
      severity: draft.severity as SeverityLevel,
      target: createTargetArea(draft.targetScope, draft.targetIds),
      validFrom: now,
      validUntil: addHours(now, draft.validityHours),
      issuedBy: officer.id,
      eventId: draft.eventId,
      supportingReportIds: draft.supportingReportIds,
    });
    alert.activate(now);
    this.deps.alerts.save(alert);

    const summary = await this.broadcastSafely('issueWarning', alert, false);
    this.publish(ALERT_EVENTS.issued, alert);
    return { alert, summary, noRecipientsFound: summary.recipients === 0 };
  }

  /** UC01 A1 "Escalate Existing Warning". */
  async escalateWarning(
    alertId: string,
    newLevel: SeverityLevel,
    reason: string,
    officer: UserAccount,
    supportingReportIds: readonly string[] = [],
  ): Promise<WarningResult> {
    requireRole(officer, Role.DMC_OFFICER);
    const alert = this.getAlert(alertId);
    alert.escalate(newLevel, reason, officer.id, this.deps.clock.now(), supportingReportIds);
    this.deps.alerts.save(alert);

    const summary = await this.broadcastSafely('escalateWarning', alert, true);
    this.publish(ALERT_EVENTS.escalated, alert);
    return { alert, summary, noRecipientsFound: summary.recipients === 0 };
  }

  resolveWarning(alertId: string, officer: UserAccount): HazardAlert {
    requireRole(officer, Role.DMC_OFFICER);
    const alert = this.getAlert(alertId);
    alert.resolve(this.deps.clock.now());
    this.deps.alerts.save(alert);
    this.publish(ALERT_EVENTS.resolved, alert);
    return alert;
  }

  /** E2: re-sends queued deliveries once connectivity is back. */
  retryQueuedDeliveries(): Promise<RetrySummary> {
    return this.deps.broadcaster.retryQueued((id) => this.deps.alerts.findById(id));
  }

  deliverySummary(alertId: string): DeliverySummary {
    return summariseDeliveries(this.deps.broadcaster.deliveriesFor(this.getAlert(alertId).id));
  }

  /** Recipients across all warnings still waiting for a successful delivery. */
  queuedDeliveryCount(): number {
    return this.deps.alerts.findAll().reduce((total, alert) => total + this.deliverySummary(alert.id).queued, 0);
  }

  /** E4 "System Error": record the failure and tell the officer the operation did not complete. */
  private async broadcastSafely(operation: string, alert: HazardAlert, isUpdate: boolean): Promise<BroadcastSummary> {
    const recipients = this.deps.users.findRecipientsInDistricts(alert.target.resolveDistrictIds(this.deps.geo));
    try {
      return await this.deps.broadcaster.broadcast(alert, recipients, isUpdate);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.deps.errorLog.record(operation, error, this.deps.clock.now());
      throw new OperationFailedError(
        `Warning ${alert.id} was saved but broadcasting could not be completed. Please retry.`,
        error,
      );
    }
  }

  private publish(type: string, alert: HazardAlert): void {
    this.deps.events.publish({
      type,
      occurredAt: this.deps.clock.now(),
      payload: { alertId: alert.id, severity: alert.severity },
    });
  }

  private sortedNewestFirst(alerts: HazardAlert[]): HazardAlert[] {
    return alerts.sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
  }
}
