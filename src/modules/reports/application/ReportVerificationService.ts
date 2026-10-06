import type { Clock } from '@/core/shared/Clock';
import { NotFoundError } from '@/core/shared/errors';
import type { EventBus } from '@/core/shared/EventBus';
import type { Repository } from '@/core/shared/Repository';
import { Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { VerifiedReportFeed, VerifiedReportSummary } from '@/modules/alerts/application/VerifiedReportFeed';
import type { GroundReport, SeverityAssessment } from '../domain/GroundReport';
import { ReportStatus } from '../domain/ReportStatus';
import type { ReportNotifier } from './ReportNotifier';
import { REPORT_EVENTS } from './ReportSubmissionService';

const SEVERITY_PRIORITY: Readonly<Record<SeverityAssessment, number>> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Duty-officer side of UC02 (steps 12-18, A1, A2). Also publishes verified
 * reports to UC01 through the VerifiedReportFeed port.
 */
export class ReportVerificationService implements VerifiedReportFeed {
  constructor(
    private readonly reports: Repository<GroundReport>,
    private readonly notifier: ReportNotifier,
    private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  /** Review queue: highest assessed severity first, then oldest first. */
  pendingQueue(): GroundReport[] {
    return this.reports
      .findWhere((report) => report.status === ReportStatus.PENDING_VERIFICATION)
      .sort(
        (a, b) =>
          SEVERITY_PRIORITY[a.severityAssessment] - SEVERITY_PRIORITY[b.severityAssessment] ||
          a.submittedAt.getTime() - b.submittedAt.getTime(),
      );
  }

  reviewedReports(): GroundReport[] {
    const reviewed = new Set([ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO]);
    return this.reports
      .findWhere((report) => reviewed.has(report.status))
      .sort((a, b) => (b.latestReview?.at.getTime() ?? 0) - (a.latestReview?.at.getTime() ?? 0));
  }

  verify(reportId: string, officer: UserAccount, credibilityScore: number, comment = ''): GroundReport {
    return this.review(reportId, officer, (report, at) => {
      report.verify(officer.id, credibilityScore, comment, at);
      this.notifier.notifyReporter(report, 'Report verified', 'Thank you. Your report was verified and is now available to the DMC warning team.');
    });
  }

  reject(reportId: string, officer: UserAccount, reason: string): GroundReport {
    return this.review(reportId, officer, (report, at) => {
      report.reject(officer.id, reason, at);
      this.notifier.notifyReporter(report, 'Report not accepted', `Reason: ${reason.trim()}`);
    });
  }

  requestMoreInformation(reportId: string, officer: UserAccount, question: string): GroundReport {
    return this.review(reportId, officer, (report, at) => {
      report.requestMoreInformation(officer.id, question, at);
      this.notifier.notifyReporter(report, 'More information needed', question.trim());
    });
  }

  listVerified(districtIds?: readonly string[]): VerifiedReportSummary[] {
    const filter = districtIds ? new Set(districtIds) : undefined;
    return this.reports
      .findWhere((report) => report.status === ReportStatus.VERIFIED && (!filter || filter.has(report.location.districtId)))
      .map((report) => {
        const review = report.verifiedReview as NonNullable<GroundReport['verifiedReview']>;
        return {
          reportId: report.id,
          hazardTypeCode: report.hazardTypeCode,
          districtId: report.location.districtId,
          summary: report.description,
          credibilityScore: review.credibilityScore ?? 0,
          verifiedAt: review.at,
          verifiedBy: review.officerId,
        };
      })
      .sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime());
  }

  private review(reportId: string, officer: UserAccount, decide: (report: GroundReport, at: Date) => void): GroundReport {
    requireRole(officer, Role.DUTY_OFFICER);
    const report = this.reports.findById(reportId);
    if (!report) throw new NotFoundError('Ground report', reportId);
    decide(report, this.clock.now());
    this.reports.save(report);
    this.events.publish({
      type: REPORT_EVENTS.reviewed,
      occurredAt: this.clock.now(),
      payload: { reportId: report.id, status: report.status },
    });
    return report;
  }
}
