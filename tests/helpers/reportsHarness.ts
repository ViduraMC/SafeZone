import { InMemoryRepository } from '@/core/shared/Repository';
import { Role, type UserAccount } from '@/core/users/UserAccount';
import { SimulatedLocationProvider } from '@/modules/reports/application/LocationProvider';
import { ReportDraftValidator, type ReportDraft } from '@/modules/reports/application/ReportDraft';
import { ReportNotifier } from '@/modules/reports/application/ReportNotifier';
import { ReportSubmissionService } from '@/modules/reports/application/ReportSubmissionService';
import { ReportVerificationService } from '@/modules/reports/application/ReportVerificationService';
import { PhotoValidator, type Evidence } from '@/modules/reports/domain/Evidence';
import type { GroundReport } from '@/modules/reports/domain/GroundReport';
import type { ReportLocation } from '@/modules/reports/domain/ReportLocation';
import { makeUser, testKernel } from './fixtures';

export const KADUWELA: ReportLocation = { latitude: 6.9339, longitude: 79.9829, source: 'GPS', districtId: 'COL', label: 'Kaduwela Junction' };
export const photo = (overrides: Partial<Evidence> = {}): Evidence => ({ id: 'PHOTO-X', fileName: 'flood.jpg', mimeType: 'image/jpeg', sizeBytes: 500_000, ...overrides });

export function validReportDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    hazardTypeCode: 'FLOOD',
    description: 'Water above knee level on the main road.',
    severityAssessment: 'HIGH',
    location: KADUWELA,
    photos: [photo()],
    ...overrides,
  };
}

/** Builds the UC02 object graph with a citizen, a volunteer and a duty officer. */
export function reportsHarness() {
  const citizen = makeUser({ roles: [Role.CITIZEN] });
  const volunteer = makeUser({ roles: [Role.CITIZEN, Role.VOLUNTEER], volunteer: { volunteerId: 'V1', trainingLevel: 'ADVANCED' } });
  const officer = makeUser({ roles: [Role.DUTY_OFFICER] });
  const users: UserAccount[] = [citizen, volunteer, officer];
  const k = testKernel(users);
  const reports = new InMemoryRepository<GroundReport>();
  const gps = new SimulatedLocationProvider({ latitude: 6.9333, longitude: 79.9833 });
  const notifier = new ReportNotifier(k.inbox, k.users, k.hazardTypes, k.geo);
  const submission = new ReportSubmissionService({
    reports,
    validator: new ReportDraftValidator(k.hazardTypes),
    photoValidator: new PhotoValidator(),
    locationProvider: gps,
    connectivity: k.connectivity,
    sync: k.sync,
    notifier,
    geo: k.geo,
    ids: k.ids,
    clock: k.clock,
    events: k.events,
  });
  k.sync.registerHandler(submission);
  const verification = new ReportVerificationService(reports, notifier, k.clock, k.events);
  return { ...k, citizen, volunteer, officer, reports, gps, notifier, submission, verification };
}
