import { DomainError, NotFoundError, ValidationError } from '@/core/shared/errors';
import { ReportDraftValidator } from '@/modules/reports/application/ReportDraft';
import { InvalidPhotoError, MAX_PHOTO_BYTES, PhotoValidator } from '@/modules/reports/domain/Evidence';
import { GroundReport, type GroundReportProps } from '@/modules/reports/domain/GroundReport';
import { locationFromGps, locationFromManualEntry } from '@/modules/reports/domain/ReportLocation';
import { canTransition, REPORT_STATUS_LABELS, ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { geo, hazardTypes, T0 } from '../helpers/fixtures';
import { KADUWELA, photo, validReportDraft } from '../helpers/reportsHarness';

const props: GroundReportProps = {
  id: 'RPT-1',
  reporterId: 'U1',
  reporterKind: 'CITIZEN',
  hazardTypeCode: 'FLOOD',
  description: 'Road flooded',
  severityAssessment: 'HIGH',
  location: KADUWELA,
  evidence: [photo()],
  submittedAt: T0,
};
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('ReportStatus transitions', () => {
  it.each([
    [ReportStatus.PENDING_SYNC, ReportStatus.PENDING_VERIFICATION, true],
    [ReportStatus.PENDING_SYNC, ReportStatus.VERIFIED, false],
    [ReportStatus.PENDING_VERIFICATION, ReportStatus.NEEDS_MORE_INFO, true],
    [ReportStatus.NEEDS_MORE_INFO, ReportStatus.PENDING_VERIFICATION, true],
    [ReportStatus.VERIFIED, ReportStatus.REJECTED, false],
    [ReportStatus.REJECTED, ReportStatus.PENDING_VERIFICATION, false],
  ])('%s -> %s allowed: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it('labels the statuses used in the UC02 scenario', () => {
    expect(REPORT_STATUS_LABELS[ReportStatus.NEEDS_MORE_INFO]).toBe('Requires Additional Information');
    expect(REPORT_STATUS_LABELS[ReportStatus.PENDING_SYNC]).toBe('Pending Synchronization');
  });
});

describe('GroundReport', () => {
  it('starts pending verification online and pending sync offline', () => {
    expect(GroundReport.submit(props, false).status).toBe(ReportStatus.PENDING_VERIFICATION);
    const offline = GroundReport.submit(props, true);
    expect(offline.status).toBe(ReportStatus.PENDING_SYNC);
    offline.markSynced(later(5));
    expect(offline.status).toBe(ReportStatus.PENDING_VERIFICATION);
    expect(offline.history.map((h) => h.to)).toEqual([ReportStatus.PENDING_SYNC, ReportStatus.PENDING_VERIFICATION]);
  });

  it('records a verification with credibility score', () => {
    const report = GroundReport.submit(props, false);
    report.verify('DO-1', 5, '  confirmed by gauge ', later(10));
    expect(report.status).toBe(ReportStatus.VERIFIED);
    expect(report.verifiedReview).toEqual({ officerId: 'DO-1', decision: 'VERIFIED', comment: 'confirmed by gauge', credibilityScore: 5, at: later(10) });
  });

  it.each([0, 6, 3.5])('rejects credibility score %s', (score) => {
    const report = GroundReport.submit(props, false);
    expect(() => report.verify('DO-1', score, '', T0)).toThrow('Credibility score must be a whole number from 1 to 5');
    expect(report.status).toBe(ReportStatus.PENDING_VERIFICATION);
  });

  it('supports the request-more-information loop with several reviews', () => {
    const report = GroundReport.submit(props, false);
    report.requestMoreInformation('DO-1', 'How deep is the water?', later(1));
    expect(report.status).toBe(ReportStatus.NEEDS_MORE_INFO);
    report.supplement('About 1 metre', [photo({ id: 'P2' })], later(2));
    expect(report.status).toBe(ReportStatus.PENDING_VERIFICATION);
    expect(report.evidence).toHaveLength(2);
    expect(report.supplements[0].text).toBe('About 1 metre');
    report.verify('DO-1', 4, '', later(3));
    expect(report.reviews.map((r) => r.decision)).toEqual(['INFO_REQUESTED', 'VERIFIED']);
    expect(report.latestReview?.decision).toBe('VERIFIED');
  });

  it('requires a reason to reject, a question to request info and text to supplement', () => {
    const report = GroundReport.submit(props, false);
    expect(() => report.reject('DO', ' ', T0)).toThrow('A rejection reason is required');
    expect(() => report.requestMoreInformation('DO', '', T0)).toThrow('Tell the reporter');
    report.requestMoreInformation('DO', 'More please', T0);
    expect(() => report.supplement('  ', [], T0)).toThrow('Provide the requested information');
  });

  it('cannot be decided twice', () => {
    const report = GroundReport.submit(props, false);
    report.reject('DO', 'Duplicate report', T0);
    expect(report.status).toBe(ReportStatus.REJECTED);
    expect(() => report.verify('DO', 5, '', T0)).toThrow(DomainError);
    expect(() => report.markSynced(T0)).toThrow('cannot become PENDING_VERIFICATION');
  });
});

describe('report locations', () => {
  const directory = geo();

  it('maps GPS coordinates to the nearest district', () => {
    expect(locationFromGps({ latitude: 7.29, longitude: 80.63 }, directory)).toMatchObject({ source: 'GPS', districtId: 'KAN', label: 'GPS location, Kandy District' });
    expect(locationFromGps({ latitude: 6.93, longitude: 79.98 }, directory, 'Kaduwela bridge').label).toBe('Kaduwela bridge');
  });

  it('rejects coordinates outside Sri Lanka', () => {
    expect(() => locationFromGps({ latitude: 51.5, longitude: -0.12 }, directory)).toThrow('outside Sri Lanka');
  });

  it('builds a manual location from district and landmark (E1)', () => {
    expect(locationFromManualEntry('GAL', ' Baddegama ', directory)).toMatchObject({ source: 'MANUAL', districtId: 'GAL', label: 'Baddegama, Galle District' });
    expect(() => locationFromManualEntry('GAL', 'ab', directory)).toThrow('Describe the place');
    expect(() => locationFromManualEntry('XX', 'Somewhere', directory)).toThrow(NotFoundError);
  });
});

describe('PhotoValidator (E4)', () => {
  const validator = new PhotoValidator();
  const file = { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 };

  it('accepts supported photos up to the size limit', () => {
    expect(() => validator.validate(file)).not.toThrow();
    expect(() => validator.validate({ ...file, mimeType: 'image/heic', sizeBytes: MAX_PHOTO_BYTES })).not.toThrow();
  });

  it.each([
    [{ mimeType: 'application/pdf' }, 'not a supported photo'],
    [{ sizeBytes: 0 }, 'empty or corrupted'],
    [{ sizeBytes: MAX_PHOTO_BYTES + 1 }, 'larger than 10 MB'],
  ])('rejects %j', (patch, message) => {
    expect(() => validator.validate({ ...file, ...patch })).toThrow(InvalidPhotoError);
    expect(() => validator.validate({ ...file, ...patch })).toThrow(message);
  });
});

describe('ReportDraftValidator (E3)', () => {
  const validator = new ReportDraftValidator(hazardTypes());

  it('accepts a complete draft', () => {
    expect(() => validator.validate(validReportDraft())).not.toThrow();
  });

  it('lists every missing field', () => {
    try {
      validator.validate({ hazardTypeCode: '', description: '', severityAssessment: '', location: undefined, photos: [] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(Object.keys((error as ValidationError).fieldErrors).sort()).toEqual(['description', 'hazardTypeCode', 'location', 'photos', 'severityAssessment']);
    }
  });

  it('limits description length and number of photos', () => {
    expect(() => validator.validate(validReportDraft({ description: 'x'.repeat(1001) }))).toThrow(ValidationError);
    expect(() => validator.validate(validReportDraft({ photos: Array.from({ length: 6 }, (_, i) => photo({ id: `P${i}` })) }))).toThrow(ValidationError);
  });
});
