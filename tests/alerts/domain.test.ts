import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { addHours } from '@/core/shared/Clock';
import { DomainError, NotFoundError } from '@/core/shared/errors';
import { DeliveryRecord, DeliveryStatus } from '@/modules/alerts/domain/DeliveryRecord';
import { AlertStatus, HazardAlert, type HazardAlertProps } from '@/modules/alerts/domain/HazardAlert';
import { createTargetArea, DistrictTarget, RiverBasinTarget } from '@/modules/alerts/domain/TargetArea';
import { geo, T0 } from '../helpers/fixtures';

const directory = geo();

describe('TargetArea strategies', () => {
  it('DistrictTarget resolves and describes its districts, removing duplicates', () => {
    const target = new DistrictTarget(['KAN', 'NUW', 'KAN']);
    expect(target.ids).toEqual(['KAN', 'NUW']);
    expect(target.resolveDistrictIds(directory)).toEqual(['KAN', 'NUW']);
    expect(target.describe(directory)).toBe('Kandy, Nuwara Eliya');
  });

  it('DistrictTarget rejects an empty selection and unknown districts', () => {
    expect(() => new DistrictTarget([])).toThrow(DomainError);
    expect(() => new DistrictTarget(['ZZZ']).resolveDistrictIds(directory)).toThrow(NotFoundError);
  });

  it('RiverBasinTarget expands to every district in the basin', () => {
    const target = new RiverBasinTarget('KELANI');
    expect(target.resolveDistrictIds(directory)).toEqual(['NUW', 'KEG', 'GAM', 'COL']);
    expect(target.describe(directory)).toBe('Kelani Ganga basin');
  });

  it('createTargetArea builds the right strategy and validates basin selection', () => {
    expect(createTargetArea('DISTRICT', ['COL'])).toBeInstanceOf(DistrictTarget);
    expect(createTargetArea('RIVER_BASIN', ['KALU'])).toBeInstanceOf(RiverBasinTarget);
    expect(() => createTargetArea('RIVER_BASIN', ['KALU', 'GIN'])).toThrow('exactly one river basin');
  });
});

function draftAlert(overrides: Partial<HazardAlertProps> = {}): HazardAlert {
  return HazardAlert.draft({
    id: 'ALT-1',
    hazardTypeCode: 'FLOOD',
    title: 'Flood warning',
    description: 'Rising water',
    severity: SeverityLevel.WARNING,
    target: new DistrictTarget(['COL']),
    validFrom: T0,
    validUntil: addHours(T0, 24),
    issuedBy: 'DMC-1',
    ...overrides,
  });
}

describe('HazardAlert lifecycle', () => {
  it('starts as a draft and becomes active when issued', () => {
    const alert = draftAlert();
    expect(alert.status).toBe(AlertStatus.DRAFT);
    expect(alert.isActiveAt(T0)).toBe(false);
    alert.activate(T0);
    expect(alert.status).toBe(AlertStatus.ACTIVE);
    expect(alert.issuedAt).toEqual(T0);
    expect(alert.isActiveAt(addHours(T0, 1))).toBe(true);
  });

  it('cannot be activated twice', () => {
    const alert = draftAlert();
    alert.activate(T0);
    expect(() => alert.activate(T0)).toThrow('Only draft warnings can be issued');
  });

  it('rejects a validity window that ends before it starts', () => {
    expect(() => draftAlert({ validUntil: T0 })).toThrow('Warning validity must end after it starts');
  });

  it('expires after its validity window', () => {
    const alert = draftAlert();
    alert.activate(T0);
    expect(alert.isActiveAt(addHours(T0, 24))).toBe(false);
  });

  it('escalates to a higher level and keeps an audit trail', () => {
    const alert = draftAlert({ supportingReportIds: ['RPT-1'] });
    alert.activate(T0);
    alert.escalate(SeverityLevel.EMERGENCY, '  Gauge exceeded  ', 'DMC-2', addHours(T0, 2), ['RPT-2']);

    expect(alert.severity).toBe(SeverityLevel.EMERGENCY);
    expect(alert.status).toBe(AlertStatus.ESCALATED);
    expect(alert.escalations).toEqual([
      { from: SeverityLevel.WARNING, to: SeverityLevel.EMERGENCY, reason: 'Gauge exceeded', escalatedBy: 'DMC-2', at: addHours(T0, 2), supportingReportIds: ['RPT-2'] },
    ]);
    expect(alert.supportingReportIds).toEqual(['RPT-1', 'RPT-2']);
  });

  it.each([
    [SeverityLevel.WARNING, 'Escalation must raise the level above WARNING'],
    [SeverityLevel.ADVISORY, 'Escalation must raise the level above WARNING'],
  ])('refuses to "escalate" to %s', (level, message) => {
    const alert = draftAlert();
    alert.activate(T0);
    expect(() => alert.escalate(level, 'reason', 'DMC', T0)).toThrow(message);
  });

  it('requires a reason to escalate and an active alert', () => {
    const alert = draftAlert();
    expect(() => alert.escalate(SeverityLevel.EMERGENCY, 'x', 'DMC', T0)).toThrow('Only active warnings can be escalated');
    alert.activate(T0);
    expect(() => alert.escalate(SeverityLevel.EMERGENCY, '   ', 'DMC', T0)).toThrow('A reason is required');
  });

  it('resolves once and is no longer active', () => {
    const alert = draftAlert();
    alert.activate(T0);
    alert.resolve(addHours(T0, 3));
    expect(alert.status).toBe(AlertStatus.RESOLVED);
    expect(alert.resolvedAt).toEqual(addHours(T0, 3));
    expect(alert.isActiveAt(addHours(T0, 4))).toBe(false);
    expect(() => alert.resolve(T0)).toThrow('Only active warnings can be resolved');
  });
});

describe('DeliveryRecord', () => {
  it('records the delivery time for successful deliveries', () => {
    const record = new DeliveryRecord('D1', 'A1', 'U1', 'COL', 'PUSH', DeliveryStatus.DELIVERED, T0);
    expect(record.deliveredAt).toEqual(T0);
    expect(record.attempts).toBe(1);
  });

  it('tracks retries of queued deliveries until one succeeds', () => {
    const record = new DeliveryRecord('D1', 'A1', 'U1', 'COL', 'SMS', DeliveryStatus.QUEUED, T0, 'gateway down');
    record.recordRetryFailure(addHours(T0, 1), 'still down');
    expect(record).toMatchObject({ status: DeliveryStatus.QUEUED, attempts: 2, failureReason: 'still down' });
    record.recordRetrySuccess(addHours(T0, 2));
    expect(record).toMatchObject({ status: DeliveryStatus.DELIVERED, attempts: 3, failureReason: undefined });
    expect(record.lastAttemptAt).toEqual(addHours(T0, 2));
  });

  it('refuses to retry deliveries that are not queued', () => {
    const record = new DeliveryRecord('D1', 'A1', 'U1', 'COL', 'PUSH', DeliveryStatus.FAILED, T0);
    expect(() => record.recordRetrySuccess(T0)).toThrow('Only queued deliveries can be retried');
    expect(() => record.recordRetryFailure(T0, 'x')).toThrow(DomainError);
  });
});
