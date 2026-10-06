import { InMemoryErrorLog } from '@/core/shared/ErrorLog';
import { ManualClock } from '@/core/shared/Clock';
import { AuthorizationError, NotFoundError, OperationFailedError, ValidationError } from '@/core/shared/errors';
import { SequentialIdGenerator } from '@/core/shared/IdGenerator';
import { InMemoryRepository } from '@/core/shared/Repository';
import type { DisasterEvent } from '@/core/events/DisasterEvent';
import { Role } from '@/core/users/UserAccount';
import { DisasterReportGenerator, type ReportRequest } from '@/modules/analytics/application/DisasterReportGenerator';
import { DmcOfficialAccessPolicy, DonorAccessPolicy } from '@/modules/analytics/application/ReportAccessPolicy';
import type { ReportSectionBuilder } from '@/modules/analytics/application/SectionBuilders';
import { ReportCategory } from '@/modules/analytics/domain/ReportCriteria';
import type { ReportSection } from '@/modules/analytics/domain/ReportSections';
import { geo, makeUser } from '../helpers/fixtures';

const NOW = new Date('2026-10-06T00:00:00Z');
const event: DisasterEvent = { id: 'EVT', name: 'Southern floods', hazardTypeCode: 'FLOOD', districtIds: ['GAL', 'MTR'], startedAt: new Date('2026-05-20'), endedAt: new Date('2026-05-28') };

function stubBuilder(category: ReportCategory, hasData = true): ReportSectionBuilder & { build: ReturnType<typeof vi.fn> } {
  return { category, build: vi.fn(() => ({ category, hasData }) as unknown as ReportSection) };
}

function generatorWith(builders: ReportSectionBuilder[]) {
  const errorLog = new InMemoryErrorLog();
  const generator = new DisasterReportGenerator(
    builders,
    [new DmcOfficialAccessPolicy(), new DonorAccessPolicy()],
    new InMemoryRepository([event, { ...event, id: 'EVT-NEW', startedAt: new Date('2026-09-01'), endedAt: undefined }]),
    geo(),
    new SequentialIdGenerator(),
    new ManualClock(NOW),
    errorLog,
  );
  return { generator, errorLog };
}

const request = (overrides: Partial<ReportRequest> = {}): ReportRequest => ({
  eventId: 'EVT',
  categories: [ReportCategory.ALERT_TIMELINE, ReportCategory.RESOURCE_DISTRIBUTION],
  districtIds: [],
  from: new Date('2026-05-19'),
  to: new Date('2026-05-30'),
  ...overrides,
});

const official = makeUser({ roles: [Role.DMC_OFFICIAL] });
const donor = makeUser({ roles: [Role.DONOR_REPRESENTATIVE], organisationId: 'OWN-RC' });

describe('DisasterReportGenerator (UC04)', () => {
  it('builds the requested sections for all event districts by default', () => {
    const timeline = stubBuilder(ReportCategory.ALERT_TIMELINE);
    const distribution = stubBuilder(ReportCategory.RESOURCE_DISTRIBUTION);
    const { generator } = generatorWith([timeline, distribution, stubBuilder(ReportCategory.SHELTER_OCCUPANCY)]);

    const report = generator.generate(request(), official);

    expect(report).toMatchObject({ eventId: 'EVT', eventName: 'Southern floods', districtIds: ['GAL', 'MTR'], generatedAt: NOW, generatedBy: official.id, notices: [] });
    expect(report.sections.map((s) => s.category)).toEqual([ReportCategory.ALERT_TIMELINE, ReportCategory.RESOURCE_DISTRIBUTION]);
    expect(timeline.build).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'EVT', districtIds: ['GAL', 'MTR'], ownerId: undefined }));
    expect(generator.supportedCategories()).toHaveLength(3);
    expect(generator.availableEvents().map((e) => e.id)).toEqual(['EVT-NEW', 'EVT']);
  });

  it('uses the selected districts only (A1) and a single category (A2)', () => {
    const distribution = stubBuilder(ReportCategory.RESOURCE_DISTRIBUTION);
    const { generator } = generatorWith([distribution]);
    const report = generator.generate(request({ categories: [ReportCategory.RESOURCE_DISTRIBUTION], districtIds: ['GAL'] }), official);
    expect(report.districtIds).toEqual(['GAL']);
    expect(report.sections).toHaveLength(1);
  });

  it('adds a notice for each section without data (E1)', () => {
    const { generator } = generatorWith([stubBuilder(ReportCategory.ALERT_TIMELINE, false), stubBuilder(ReportCategory.RESOURCE_DISTRIBUTION)]);
    expect(generator.generate(request(), official).notices).toEqual(['No alert timeline data was recorded for the selected districts and period.']);
  });

  it('validates categories, districts and the period against the event (E2)', () => {
    const { generator } = generatorWith([stubBuilder(ReportCategory.ALERT_TIMELINE)]);
    const errorsFor = (r: ReportRequest) => {
      try {
        generator.generate(r, official);
        return {};
      } catch (error) {
        return (error as ValidationError).fieldErrors;
      }
    };
    expect(errorsFor(request({ categories: [] }))).toHaveProperty('categories', 'Select at least one report category');
    expect(errorsFor(request({ categories: [ReportCategory.CITIZENS_REACHED] }))).toHaveProperty('categories', 'Unsupported report category');
    expect(errorsFor(request({ categories: [ReportCategory.ALERT_TIMELINE], districtIds: ['ZZ'] }))).toHaveProperty('districtIds');
    expect(errorsFor(request({ categories: [ReportCategory.ALERT_TIMELINE], from: new Date('2026-07-01'), to: new Date('2026-07-05') }))).toHaveProperty('period');
    expect(() => generator.generate(request({ from: new Date('2026-06-01'), to: new Date('2026-05-01') }), official)).toThrow(ValidationError);
    expect(() => generator.generate(request({ eventId: 'NOPE' }), official)).toThrow(NotFoundError);
  });

  it('limits donors to the distribution of their own resources (E3 / A3)', () => {
    const distribution = stubBuilder(ReportCategory.RESOURCE_DISTRIBUTION);
    const { generator } = generatorWith([stubBuilder(ReportCategory.ALERT_TIMELINE), distribution]);

    expect(() => generator.generate(request(), donor)).toThrow(AuthorizationError);
    generator.generate(request({ categories: [ReportCategory.RESOURCE_DISTRIBUTION] }), donor);
    expect(distribution.build).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'OWN-RC' }));
  });

  it('refuses donors without an organisation and users without any reporting role', () => {
    const { generator } = generatorWith([stubBuilder(ReportCategory.RESOURCE_DISTRIBUTION)]);
    const categories = [ReportCategory.RESOURCE_DISTRIBUTION];
    expect(() => generator.generate(request({ categories }), makeUser({ roles: [Role.DONOR_REPRESENTATIVE] }))).toThrow('not linked to a donor organisation');
    expect(() => generator.generate(request({ categories }), makeUser())).toThrow('You do not have access');
  });

  it('logs unexpected builder failures and asks the user to retry (E4)', () => {
    const broken: ReportSectionBuilder = {
      category: ReportCategory.ALERT_TIMELINE,
      build: () => {
        throw new TypeError('cannot read property');
      },
    };
    const { generator, errorLog } = generatorWith([broken]);
    expect(() => generator.generate(request({ categories: [ReportCategory.ALERT_TIMELINE] }), official)).toThrow(OperationFailedError);
    expect(errorLog.entries()[0]).toMatchObject({ operation: 'generateReport:ALERT_TIMELINE', message: 'cannot read property' });
  });
});

