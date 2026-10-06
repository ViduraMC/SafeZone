import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { ValidationError } from '@/core/shared/errors';
import type { AlertFact, DeliveryFact, DistributionFact, OccupancyFact, RescueMissionFact } from '@/modules/analytics/application/DataSources';
import {
  AlertTimelineBuilder,
  CitizensReachedBuilder,
  RescueOperationsBuilder,
  ResourceDistributionBuilder,
  ShelterOccupancyBuilder,
  type SectionContext,
} from '@/modules/analytics/application/SectionBuilders';
import { MAX_PERIOD_DAYS, ReportingPeriod } from '@/modules/analytics/domain/ReportCriteria';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NOW = d('2026-10-01');

describe('ReportingPeriod (UC04 E2)', () => {
  it('accepts a valid range and checks containment / overlap', () => {
    const period = ReportingPeriod.of(d('2026-05-01'), d('2026-05-31'), NOW);
    expect(period.contains(d('2026-05-15'))).toBe(true);
    expect(period.contains(d('2026-06-01'))).toBe(false);
    expect(period.overlaps(d('2026-04-01'), undefined)).toBe(true);
    expect(period.overlaps(d('2026-04-01'), d('2026-04-30'))).toBe(false);
    expect(period.overlaps(d('2026-06-02'), undefined)).toBe(false);
  });

  it.each([
    [d('2026-05-31'), d('2026-05-01'), 'start date must be before'],
    [d('2026-05-01'), d('2026-05-01'), 'start date must be before'],
    [d('2026-11-01'), d('2026-12-01'), 'cannot start in the future'],
    [d('2024-01-01'), d('2026-01-01'), `cannot exceed ${MAX_PERIOD_DAYS} days`],
    [new Date('invalid'), d('2026-05-01'), 'Enter both'],
  ])('rejects %s .. %s', (from, to, message) => {
    expect(() => ReportingPeriod.of(from, to, NOW)).toThrow(ValidationError);
    try {
      ReportingPeriod.of(from, to, NOW);
    } catch (error) {
      expect((error as ValidationError).fieldErrors.period).toContain(message);
    }
  });
});

const ctx = (overrides: Partial<SectionContext> = {}): SectionContext => ({
  eventId: 'EVT',
  districtIds: ['GAL', 'MTR'],
  period: ReportingPeriod.of(d('2026-05-20'), d('2026-05-30'), NOW),
  ...overrides,
});

const alerts: AlertFact[] = [
  {
    alertId: 'A1',
    title: 'Gin Ganga flood',
    severity: SeverityLevel.EMERGENCY,
    initialSeverity: SeverityLevel.WARNING,
    eventId: 'EVT',
    districtIds: ['GAL'],
    issuedAt: d('2026-05-20'),
    resolvedAt: d('2026-05-26'),
    escalations: [{ at: d('2026-05-21'), to: SeverityLevel.EMERGENCY, reason: 'gauge' }],
  },
  { alertId: 'A2', title: 'Other event', severity: SeverityLevel.WARNING, initialSeverity: SeverityLevel.WARNING, eventId: 'OTHER', districtIds: ['GAL'], issuedAt: d('2026-05-22'), escalations: [] },
  { alertId: 'A3', title: 'Kandy only', severity: SeverityLevel.WARNING, initialSeverity: SeverityLevel.WARNING, districtIds: ['KAN'], issuedAt: d('2026-05-22'), escalations: [] },
  { alertId: 'A4', title: 'Carried over', severity: SeverityLevel.ADVISORY, initialSeverity: SeverityLevel.ADVISORY, districtIds: ['MTR'], issuedAt: d('2026-05-18'), escalations: [] },
];
const alertSource = { alerts: () => alerts };

describe('AlertTimelineBuilder', () => {
  it('lists issue, escalation and resolution events in time order for matching alerts only', () => {
    const section = new AlertTimelineBuilder(alertSource).build(ctx());
    expect(section.entries.map((e) => `${e.alertId}:${e.action}:${e.severity}`)).toEqual(['A1:ISSUED:WARNING', 'A1:ESCALATED:EMERGENCY', 'A1:RESOLVED:EMERGENCY']);
    expect(section.totals).toEqual({ issued: 1, escalated: 1, resolved: 1 });
    expect(section.entries[1].note).toBe('gauge');
    expect(section.hasData).toBe(true);
  });

  it('reports no data for districts without alerts', () => {
    expect(new AlertTimelineBuilder(alertSource).build(ctx({ districtIds: ['JAF'] })).hasData).toBe(false);
  });
});

describe('CitizensReachedBuilder', () => {
  const deliveries: DeliveryFact[] = [
    { alertId: 'A1', recipientId: 'U1', districtId: 'GAL', channel: 'PUSH', delivered: false },
    { alertId: 'A1', recipientId: 'U1', districtId: 'GAL', channel: 'SMS', delivered: true },
    { alertId: 'A1', recipientId: 'U2', districtId: 'GAL', channel: 'SMS', delivered: false },
    { alertId: 'A4', recipientId: 'U3', districtId: 'MTR', channel: 'PUSH', delivered: true },
    { alertId: 'A4', recipientId: 'U4', districtId: 'COL', channel: 'PUSH', delivered: true },
  ];
  const deliverySource = { deliveriesFor: (ids: readonly string[]) => deliveries.filter((x) => ids.includes(x.alertId)) };

  it('counts unique targeted and reached citizens per district and channel', () => {
    const section = new CitizensReachedBuilder(alertSource, deliverySource).build(ctx());
    expect(section).toMatchObject({ targeted: 3, reached: 2, hasData: true, deliveriesByChannel: { SMS: 1, PUSH: 1 } });
    expect(section.reachRate).toBeCloseTo(2 / 3);
    expect(section.byDistrict).toEqual([
      { districtId: 'GAL', targeted: 2, reached: 1 },
      { districtId: 'MTR', targeted: 1, reached: 1 },
    ]);
  });

  it('returns a zero rate when nobody was targeted', () => {
    const section = new CitizensReachedBuilder(alertSource, { deliveriesFor: () => [] }).build(ctx());
    expect(section).toMatchObject({ targeted: 0, reachRate: 0, hasData: false });
  });
});

describe('ShelterOccupancyBuilder', () => {
  const snap = (shelterId: string, districtId: string, occupancy: number, at: string, capacity = 100): OccupancyFact => ({
    shelterId,
    shelterName: `Shelter ${shelterId}`,
    districtId,
    occupancy,
    capacity,
    at: d(at),
  });
  const snapshots = [
    snap('S1', 'GAL', 20, '2026-05-18'),
    snap('S1', 'GAL', 80, '2026-05-21'),
    snap('S2', 'GAL', 50, '2026-05-22', 60),
    snap('S1', 'GAL', 30, '2026-05-25'),
    snap('S3', 'COL', 99, '2026-05-22'),
    snap('S4', 'MTR', 10, '2026-06-05'),
  ];

  it('builds per-shelter series with a carried-in baseline and finds the combined peak', () => {
    const section = new ShelterOccupancyBuilder({ snapshots: () => snapshots }).build(ctx());
    const s1 = section.shelters.find((s) => s.shelterId === 'S1');
    expect(s1?.points.map((p) => p.occupancy)).toEqual([20, 80, 30]);
    expect(s1?.points[0].at).toEqual(d('2026-05-20'));
    expect(s1?.peakOccupancy).toBe(80);
    expect(section.shelters.map((s) => s.shelterId)).toEqual(['S1', 'S2']);
    expect(section).toMatchObject({ totalCapacity: 160, peakTotalOccupancy: 130, hasData: true });
    expect(section.peakUtilisation).toBeCloseTo(130 / 160);
  });

  it('has no data when no shelters exist in the districts', () => {
    expect(new ShelterOccupancyBuilder({ snapshots: () => snapshots }).build(ctx({ districtIds: ['JAF'] }))).toMatchObject({ hasData: false, peakUtilisation: 0 });
  });
});

describe('ResourceDistributionBuilder', () => {
  const fact = (overrides: Partial<DistributionFact>): DistributionFact => ({
    districtId: 'GAL',
    ownerId: 'OWN-RC',
    ownerName: 'Red Cross',
    ownerType: 'NGO',
    category: 'WATER',
    itemName: 'Purification kits',
    unit: 'kits',
    quantity: 10,
    eventId: 'EVT',
    at: d('2026-05-21'),
    ...overrides,
  });
  const facts = [
    fact({}),
    fact({ quantity: 5 }),
    fact({ districtId: 'MTR', ownerId: 'OWN-ARMY', ownerName: 'Army', ownerType: 'ARMED_FORCES', category: 'FOOD', itemName: 'Meals', unit: 'packets', quantity: 100 }),
    fact({ eventId: 'OTHER', quantity: 999 }),
    fact({ at: d('2026-06-15'), quantity: 999 }),
    fact({ districtId: 'COL', quantity: 999 }),
  ];
  const source = { distributions: () => facts };

  it('aggregates by district, category, item and contributor (A1 multi-district)', () => {
    const section = new ResourceDistributionBuilder(source).build(ctx());
    expect(section.rows).toEqual([
      { districtId: 'GAL', category: 'WATER', itemName: 'Purification kits', unit: 'kits', ownerName: 'Red Cross', quantity: 15 },
      { districtId: 'MTR', category: 'FOOD', itemName: 'Meals', unit: 'packets', ownerName: 'Army', quantity: 100 },
    ]);
    expect(section.totalsByDistrict).toEqual({ GAL: 15, MTR: 100 });
    expect(section.totalsByCategory).toEqual({ WATER: 15, FOOD: 100 });
    expect(section.byOwner.map((o) => o.ownerName)).toEqual(['Army', 'Red Cross']);
  });

  it('restricts the section to one donor (A3)', () => {
    const section = new ResourceDistributionBuilder(source).build(ctx({ ownerId: 'OWN-RC' }));
    expect(section.byOwner).toEqual([{ ownerId: 'OWN-RC', ownerName: 'Red Cross', ownerType: 'NGO', quantity: 15 }]);
    expect(section.restrictedToOwnerId).toBe('OWN-RC');
  });

  it('flags missing data (E1)', () => {
    expect(new ResourceDistributionBuilder(source).build(ctx({ districtIds: ['KAN'] })).hasData).toBe(false);
  });
});

describe('RescueOperationsBuilder', () => {
  const mission = (overrides: Partial<RescueMissionFact>): RescueMissionFact => ({
    teamId: 'T1',
    teamName: 'Navy Boat 1',
    ownerName: 'Navy',
    districtId: 'GAL',
    eventId: 'EVT',
    dispatchedAt: new Date('2026-05-21T08:00:00Z'),
    onSceneAt: new Date('2026-05-21T09:00:00Z'),
    completedAt: new Date('2026-05-21T12:00:00Z'),
    peopleRescued: 10,
    crossOrganisation: false,
    ...overrides,
  });
  const source = {
    missions: () => [
      mission({}),
      mission({ onSceneAt: new Date('2026-05-21T08:30:00Z'), peopleRescued: 4, crossOrganisation: true }),
      mission({ teamId: 'T2', teamName: 'Army 2', ownerName: 'Army', districtId: 'MTR', onSceneAt: undefined, peopleRescued: 20 }),
      mission({ eventId: 'OTHER', peopleRescued: 999 }),
      mission({ completedAt: new Date('2026-06-15T00:00:00Z'), peopleRescued: 999 }),
      mission({ districtId: 'COL', peopleRescued: 999 }),
    ],
  };

  it('summarises missions, people rescued, response time and team performance', () => {
    const section = new RescueOperationsBuilder(source).build(ctx());
    expect(section).toMatchObject({ hasData: true, missions: 3, peopleRescued: 34, averageResponseMinutes: 45, crossOrganisationMissions: 1 });
    expect(section.byTeam).toEqual([
      { teamName: 'Army 2', ownerName: 'Army', missions: 1, peopleRescued: 20 },
      { teamName: 'Navy Boat 1', ownerName: 'Navy', missions: 2, peopleRescued: 14 },
    ]);
  });

  it('leaves the response time undefined when no arrival was recorded', () => {
    const section = new RescueOperationsBuilder(source).build(ctx({ districtIds: ['MTR'] }));
    expect(section.averageResponseMinutes).toBeUndefined();
    expect(new RescueOperationsBuilder(source).build(ctx({ districtIds: ['JAF'] })).hasData).toBe(false);
  });
});
