import { AuthorizationError, NotFoundError, ValidationError } from '@/core/shared/errors';
import { Role } from '@/core/users/UserAccount';
import { LocationUnavailableError } from '@/modules/reports/application/LocationProvider';
import { REPORT_EVENTS, REPORT_SYNC_KIND } from '@/modules/reports/application/ReportSubmissionService';
import { InvalidPhotoError } from '@/modules/reports/domain/Evidence';
import { ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { makeUser } from '../helpers/fixtures';
import { reportsHarness, validReportDraft } from '../helpers/reportsHarness';

describe('ReportSubmissionService (UC02 reporter side)', () => {
  it('submits online, stores the report pending verification and notifies duty officers', () => {
    const h = reportsHarness();
    const report = h.submission.submit(validReportDraft({ description: '  Water above knee level on the main road.  ' }), h.citizen);

    expect(report.status).toBe(ReportStatus.PENDING_VERIFICATION);
    expect(report.description).toBe('Water above knee level on the main road.');
    expect(report.reporterKind).toBe('CITIZEN');
    expect(h.reports.findById(report.id)).toBe(report);
    expect(h.inbox.forUser(h.officer.id)[0]).toMatchObject({ title: 'New ground report: Flood - Colombo', link: `/review/${report.id}` });
    expect(h.published.map((e) => e.type)).toContain(REPORT_EVENTS.submitted);
  });

  it('marks volunteer reports as volunteer reports', () => {
    const h = reportsHarness();
    expect(h.submission.submit(validReportDraft(), h.volunteer).reporterKind).toBe('VOLUNTEER');
  });

  it('stores reports offline and syncs them when connectivity returns (E2)', async () => {
    const h = reportsHarness();
    h.connectivity.setOnline(false);
    const report = h.submission.submit(validReportDraft(), h.citizen);

    expect(report.status).toBe(ReportStatus.PENDING_SYNC);
    expect(h.sync.pending()).toMatchObject([{ kind: REPORT_SYNC_KIND, entityId: report.id }]);
    expect(h.inbox.forUser(h.officer.id)).toHaveLength(0);

    h.connectivity.setOnline(true);
    await h.sync.flush();

    expect(report.status).toBe(ReportStatus.PENDING_VERIFICATION);
    expect(h.inbox.forUser(h.officer.id)).toHaveLength(1);
    expect(h.published.map((e) => e.type)).toContain(REPORT_EVENTS.synced);
  });

  it('rejects incomplete reports and reports from officers', () => {
    const h = reportsHarness();
    expect(() => h.submission.submit(validReportDraft({ photos: [] }), h.citizen)).toThrow(ValidationError);
    expect(() => h.submission.submit(validReportDraft(), h.officer)).toThrow(AuthorizationError);
    expect(h.reports.count()).toBe(0);
  });

  it('detects the GPS location, or reports GPS as unavailable (E1)', async () => {
    const h = reportsHarness();
    await expect(h.submission.detectLocation()).resolves.toMatchObject({ source: 'GPS', districtId: 'COL' });
    h.gps.setAvailable(false);
    expect(h.gps.isAvailable()).toBe(false);
    await expect(h.submission.detectLocation()).rejects.toBeInstanceOf(LocationUnavailableError);
    expect(h.submission.manualLocation('COL', 'Kaduwela')).toMatchObject({ source: 'MANUAL' });
  });

  it('uses the moved GPS position', async () => {
    const h = reportsHarness();
    h.gps.moveTo({ latitude: 6.05, longitude: 80.22 });
    await expect(h.submission.detectLocation()).resolves.toMatchObject({ districtId: 'GAL' });
  });

  it('validates photos and assigns evidence ids (E4)', () => {
    const h = reportsHarness();
    expect(h.submission.attachPhoto({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }).id).toMatch(/^PHOTO-/);
    expect(() => h.submission.attachPhoto({ fileName: 'a.gif', mimeType: 'image/gif', sizeBytes: 10 })).toThrow(InvalidPhotoError);
  });

  it('lets only the original reporter answer an information request (A1)', () => {
    const h = reportsHarness();
    const report = h.submission.submit(validReportDraft(), h.citizen);
    h.verification.requestMoreInformation(report.id, h.officer, 'How deep?');

    expect(() => h.submission.provideAdditionalInformation(report.id, h.volunteer, 'not mine')).toThrow(AuthorizationError);
    h.submission.provideAdditionalInformation(report.id, h.citizen, 'Waist deep');

    expect(report.status).toBe(ReportStatus.PENDING_VERIFICATION);
    expect(h.inbox.forUser(h.officer.id)[0].title).toBe(`Report ${report.id} updated by reporter`);
  });

  it('lists my reports newest first and throws for unknown reports', () => {
    const h = reportsHarness();
    const first = h.submission.submit(validReportDraft(), h.citizen);
    h.clock.advanceMinutes(5);
    const second = h.submission.submit(validReportDraft(), h.citizen);
    h.submission.submit(validReportDraft(), h.volunteer);

    expect(h.submission.myReports(h.citizen.id).map((r) => r.id)).toEqual([second.id, first.id]);
    expect(() => h.submission.getReport('RPT-404')).toThrow(NotFoundError);
  });
});

describe('ReportVerificationService (UC02 duty officer side)', () => {
  it('orders the queue by assessed severity, then by age', () => {
    const h = reportsHarness();
    const low = h.submission.submit(validReportDraft({ severityAssessment: 'LOW' }), h.citizen);
    h.clock.advanceMinutes(1);
    const highOld = h.submission.submit(validReportDraft({ severityAssessment: 'HIGH' }), h.citizen);
    h.clock.advanceMinutes(1);
    const highNew = h.submission.submit(validReportDraft({ severityAssessment: 'HIGH' }), h.citizen);
    h.clock.advanceMinutes(1);
    const medium = h.submission.submit(validReportDraft({ severityAssessment: 'MEDIUM' }), h.citizen);

    expect(h.verification.pendingQueue().map((r) => r.id)).toEqual([highOld.id, highNew.id, medium.id, low.id]);
  });

  it('verifies a report, notifies the reporter and publishes it to the warning process', () => {
    const h = reportsHarness();
    const report = h.submission.submit(validReportDraft(), h.volunteer);
    h.clock.advanceMinutes(15);

    h.verification.verify(report.id, h.officer, 5, 'matches gauge');

    expect(report.status).toBe(ReportStatus.VERIFIED);
    expect(h.inbox.forUser(h.volunteer.id)[0].title).toBe('Report verified');
    expect(h.verification.listVerified()).toEqual([
      { reportId: report.id, hazardTypeCode: 'FLOOD', districtId: 'COL', summary: report.description, credibilityScore: 5, verifiedAt: h.clock.now(), verifiedBy: h.officer.id },
    ]);
    expect(h.verification.listVerified(['KAN'])).toEqual([]);
    expect(h.verification.pendingQueue()).toEqual([]);
    expect(h.published.map((e) => e.type)).toContain(REPORT_EVENTS.reviewed);
  });

  it('rejects with a reason so the report cannot influence warnings (A2)', () => {
    const h = reportsHarness();
    const report = h.submission.submit(validReportDraft(), h.citizen);

    h.verification.reject(report.id, h.officer, 'Duplicate of an earlier report');

    expect(report.status).toBe(ReportStatus.REJECTED);
    expect(h.inbox.forUser(h.citizen.id)[0]).toMatchObject({ title: 'Report not accepted', body: 'Reason: Duplicate of an earlier report' });
    expect(h.verification.listVerified()).toEqual([]);
  });

  it('lists reviewed reports newest decision first', () => {
    const h = reportsHarness();
    const a = h.submission.submit(validReportDraft(), h.citizen);
    const b = h.submission.submit(validReportDraft(), h.citizen);
    h.verification.reject(a.id, h.officer, 'reason');
    h.clock.advanceMinutes(1);
    h.verification.requestMoreInformation(b.id, h.officer, 'question');
    expect(h.verification.reviewedReports().map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('only allows duty officers to decide and fails for unknown reports', () => {
    const h = reportsHarness();
    const report = h.submission.submit(validReportDraft(), h.citizen);
    expect(() => h.verification.verify(report.id, makeUser({ roles: [Role.DMC_OFFICER] }), 5)).toThrow(AuthorizationError);
    expect(() => h.verification.verify('RPT-404', h.officer, 5)).toThrow(NotFoundError);
  });
});
