import type { HazardTypeRegistry } from '@/core/hazard/HazardType';
import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { InboxService } from '@/core/notifications/Inbox';
import { Role } from '@/core/users/UserAccount';
import type { UserDirectory } from '@/core/users/UserDirectory';
import type { GroundReport } from '../domain/GroundReport';

/**
 * Sends UC02 notifications. Replaces the direct GroundReport -> DutyOfficer
 * message in the original sequence diagram with a dedicated collaborator.
 */
export class ReportNotifier {
  constructor(
    private readonly inbox: InboxService,
    private readonly users: UserDirectory,
    private readonly hazardTypes: HazardTypeRegistry,
    private readonly geo: GeoDirectory,
  ) {}

  /** Main flow step 11: duty officers are told about a new report to review. */
  notifyDutyOfficers(report: GroundReport, isResubmission = false): void {
    const hazard = this.hazardTypes.get(report.hazardTypeCode).name;
    const district = this.geo.districtName(report.location.districtId);
    const title = isResubmission ? `Report ${report.id} updated by reporter` : `New ground report: ${hazard} - ${district}`;
    this.users.findByRole(Role.DUTY_OFFICER).forEach((officer) =>
      this.inbox.deliver({
        userId: officer.id,
        kind: 'REPORT_UPDATE',
        title,
        body: `${report.severityAssessment} severity reported at ${report.location.label}. Pending verification.`,
        link: `/review/${report.id}`,
      }),
    );
  }

  notifyReporter(report: GroundReport, title: string, body: string): void {
    this.inbox.deliver({ userId: report.reporterId, kind: 'REPORT_UPDATE', title, body, link: `/my-reports/${report.id}` });
  }
}
