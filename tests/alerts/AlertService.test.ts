import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { AuthorizationError, NotFoundError, OperationFailedError, ValidationError } from '@/core/shared/errors';
import { Role } from '@/core/users/UserAccount';
import { ALERT_EVENTS } from '@/modules/alerts/application/AlertService';
import { summariseDeliveries } from '@/modules/alerts/application/DeliverySummary';
import { DeliveryRecord, DeliveryStatus } from '@/modules/alerts/domain/DeliveryRecord';
import { AlertStatus } from '@/modules/alerts/domain/HazardAlert';
import { alertsHarness, dmcOfficer, validDraft } from '../helpers/alertsHarness';
import { makeUser, T0 } from '../helpers/fixtures';

const smartphoneCitizen = (districtId = 'COL') => makeUser({ homeDistrictId: districtId, contact: { hasSmartphone: true, smsOptIn: false } });
const basicPhoneCitizen = (districtId = 'COL') => makeUser({ homeDistrictId: districtId, contact: { hasSmartphone: false, smsOptIn: true } });

describe('AlertService.issueWarning (UC01 main flow)', () => {
  it('stores an active warning and delivers it to every citizen in the target area', async () => {
    const officer = dmcOfficer();
    const colombo = [smartphoneCitizen(), basicPhoneCitizen()];
    const kandy = smartphoneCitizen('KAN');
    const h = alertsHarness([officer, ...colombo, kandy]);

    const result = await h.service.issueWarning(validDraft(), officer);

    expect(result.alert.status).toBe(AlertStatus.ACTIVE);
    expect(result.alert.issuedBy).toBe(officer.id);
    expect(h.alerts.findById(result.alert.id)).toBe(result.alert);
    expect(result.summary).toMatchObject({ recipients: 2, reached: 2, queued: 0 });
    expect(result.summary.byChannel).toEqual({ PUSH: { delivered: 1, failed: 0 }, SMS: { delivered: 2, failed: 0 } });
    expect(result.noRecipientsFound).toBe(false);
    expect(h.inbox.forUser(kandy.id)).toHaveLength(0);
    expect(h.published.map((e) => e.type)).toContain(ALERT_EVENTS.issued);
  });

  it('targets every district of a river basin (A3)', async () => {
    const officer = dmcOfficer();
    const users = ['NUW', 'KEG', 'GAM', 'COL', 'GAL'].map((d) => smartphoneCitizen(d));
    const h = alertsHarness([officer, ...users]);

    const result = await h.service.issueWarning(validDraft({ targetScope: 'RIVER_BASIN', targetIds: ['KELANI'] }), officer);

    expect(result.summary.recipients).toBe(4);
  });

  it('keeps the warning when no citizens are registered in the area (E3)', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);

    const result = await h.service.issueWarning(validDraft({ targetIds: ['MUL'] }), officer);

    expect(result.noRecipientsFound).toBe(true);
    expect(h.alerts.count()).toBe(1);
  });

  it('rejects invalid input without storing anything (E1)', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    await expect(h.service.issueWarning(validDraft({ title: '' }), officer)).rejects.toBeInstanceOf(ValidationError);
    expect(h.alerts.count()).toBe(0);
  });

  it('only allows DMC officers to issue warnings', async () => {
    const citizen = smartphoneCitizen();
    const h = alertsHarness([citizen]);
    await expect(h.service.issueWarning(validDraft(), citizen)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('logs unexpected broadcast failures and reports them to the officer (E4)', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer, smartphoneCitizen()]);
    vi.spyOn(h.broadcaster, 'broadcast').mockRejectedValueOnce(new Error('queue offline'));

    await expect(h.service.issueWarning(validDraft(), officer)).rejects.toBeInstanceOf(OperationFailedError);
    expect(h.errorLog.entries()).toEqual([{ operation: 'issueWarning', message: 'queue offline', at: T0 }]);
    expect(h.alerts.count()).toBe(1);
  });
});

describe('network failures and retries (UC01 E2)', () => {
  it('falls back to SMS when push fails', async () => {
    const officer = dmcOfficer();
    const citizen = makeUser({ contact: { hasSmartphone: true, smsOptIn: true } });
    const h = alertsHarness([officer, citizen]);
    h.connectivity.setOnline(false);

    const { summary } = await h.service.issueWarning(validDraft({ severity: SeverityLevel.ADVISORY }), officer);

    expect(summary.reached).toBe(1);
    expect(summary.byChannel.PUSH.failed).toBe(1);
    expect(summary.byChannel.SMS.delivered).toBe(1);
  });

  it('tries an unplanned channel before giving up', async () => {
    const officer = dmcOfficer();
    const citizen = makeUser({ contact: { hasSmartphone: true, smsOptIn: false } });
    const h = alertsHarness([officer, citizen]);
    h.connectivity.setOnline(false);

    // Advisory + no SMS opt-in => plan is push only; SMS is used as the alternative channel.
    const { summary } = await h.service.issueWarning(validDraft({ severity: SeverityLevel.ADVISORY }), officer);

    expect(summary).toMatchObject({ reached: 1, queued: 0 });
  });

  it('queues recipients no channel can reach and delivers them on retry', async () => {
    const officer = dmcOfficer();
    const basic = basicPhoneCitizen();
    const h = alertsHarness([officer, basic]);
    h.sms.setAvailable(false);

    const { alert, summary } = await h.service.issueWarning(validDraft(), officer);
    expect(summary).toMatchObject({ reached: 0, queued: 1 });
    expect(h.service.queuedDeliveryCount()).toBe(1);

    const stillDown = await h.service.retryQueuedDeliveries();
    expect(stillDown).toEqual({ retried: 1, delivered: 0, stillQueued: 1 });

    h.sms.setAvailable(true);
    const retried = await h.service.retryQueuedDeliveries();
    expect(retried).toEqual({ retried: 1, delivered: 1, stillQueued: 0 });
    expect(h.service.deliverySummary(alert.id)).toMatchObject({ recipients: 1, reached: 1, queued: 0 });
  });

  it('skips queued records whose alert or channel no longer exists', async () => {
    const h = alertsHarness([basicPhoneCitizen()]);
    h.deliveries.save(new DeliveryRecord('D1', 'GONE', 'U?', 'COL', 'SMS', DeliveryStatus.QUEUED, T0));
    await expect(h.broadcaster.retryQueued(() => undefined)).resolves.toEqual({ retried: 1, delivered: 0, stillQueued: 1 });
  });
});

describe('preview, escalation and resolution', () => {
  it('previews recipients, channels and audible override before issuing', () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer, smartphoneCitizen(), basicPhoneCitizen()]);

    const preview = h.service.preview(validDraft({ severity: SeverityLevel.EMERGENCY, validityHours: 6 }));

    expect(preview).toMatchObject({ areaDescription: 'Colombo', districtIds: ['COL'], recipientCount: 2, audibleOverride: true });
    expect([...preview.channels].sort()).toEqual(['PUSH', 'SMS']);
    expect(preview.validUntil).toEqual(new Date(T0.getTime() + 6 * 3_600_000));
  });

  it('previews an empty area without audible override', () => {
    const h = alertsHarness();
    expect(h.service.preview(validDraft({ targetIds: ['MUL'] }))).toMatchObject({ recipientCount: 0, channels: [], audibleOverride: false });
  });

  it('escalates, re-broadcasts an update and links supporting reports (A1)', async () => {
    const officer = dmcOfficer();
    const citizen = smartphoneCitizen();
    const h = alertsHarness([officer, citizen]);
    const { alert } = await h.service.issueWarning(validDraft(), officer);
    h.clock.advanceMinutes(30);

    const result = await h.service.escalateWarning(alert.id, SeverityLevel.EMERGENCY, 'Gauge exceeded', officer, ['RPT-1']);

    expect(result.alert.severity).toBe(SeverityLevel.EMERGENCY);
    expect(result.alert.supportingReportIds).toEqual(['RPT-1']);
    expect(h.inbox.forUser(citizen.id)[0]).toMatchObject({ title: expect.stringMatching(/^UPDATED EMERGENCY/), audibleOverride: true });
    expect(h.published.map((e) => e.type)).toContain(ALERT_EVENTS.escalated);
  });

  it('rejects escalation of unknown alerts and by non-officers', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    await expect(h.service.escalateWarning('ALT-404', SeverityLevel.EMERGENCY, 'x', officer)).rejects.toBeInstanceOf(NotFoundError);
    const { alert } = await h.service.issueWarning(validDraft(), officer);
    await expect(h.service.escalateWarning(alert.id, SeverityLevel.EMERGENCY, 'x', makeUser())).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('resolves a warning and moves it to the archive', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    const { alert } = await h.service.issueWarning(validDraft(), officer);

    h.service.resolveWarning(alert.id, officer);

    expect(h.service.listActive()).toEqual([]);
    expect(h.service.listArchived()).toEqual([alert]);
    expect(h.service.listForDistrict('COL')).toEqual({ active: [], archived: [alert] });
    expect(h.published.map((e) => e.type)).toContain(ALERT_EVENTS.resolved);
  });
});

describe('queries', () => {
  it('lists newest active warnings first and filters by district', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    const first = await h.service.issueWarning(validDraft({ targetIds: ['COL'] }), officer);
    h.clock.advanceMinutes(10);
    const second = await h.service.issueWarning(validDraft({ targetIds: ['KAN'] }), officer);

    expect(h.service.listActive().map((a) => a.id)).toEqual([second.alert.id, first.alert.id]);
    expect(h.service.listForDistrict('KAN').active.map((a) => a.id)).toEqual([second.alert.id]);
    expect(h.service.getAlert(first.alert.id)).toBe(first.alert);
  });

  it('builds the dashboard from active alerts and the verified report feed', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    await h.service.issueWarning(validDraft(), officer);
    expect(h.service.dashboard().activeAlerts).toHaveLength(1);
    expect(h.verifiedReports.listVerified).toHaveBeenCalled();
  });
});

describe('summariseDeliveries', () => {
  it('counts unique recipients, reached people, queued people and failed attempts', () => {
    const records = [
      new DeliveryRecord('1', 'A', 'U1', 'COL', 'PUSH', DeliveryStatus.FAILED, T0),
      new DeliveryRecord('2', 'A', 'U1', 'COL', 'SMS', DeliveryStatus.DELIVERED, T0),
      new DeliveryRecord('3', 'A', 'U2', 'COL', 'SMS', DeliveryStatus.QUEUED, T0),
      new DeliveryRecord('4', 'A', 'U3', 'COL', 'PUSH', DeliveryStatus.DELIVERED, T0),
    ];
    expect(summariseDeliveries(records)).toEqual({
      recipients: 3,
      reached: 2,
      queued: 1,
      failedAttempts: 1,
      deliveredByChannel: { PUSH: 1, SMS: 1 },
    });
  });

  it('returns zeros for no records', () => {
    expect(summariseDeliveries([])).toMatchObject({ recipients: 0, reached: 0, queued: 0 });
  });
});

describe('role check helper', () => {
  it('rejects resolve by a duty officer', async () => {
    const officer = dmcOfficer();
    const h = alertsHarness([officer]);
    const { alert } = await h.service.issueWarning(validDraft(), officer);
    expect(() => h.service.resolveWarning(alert.id, makeUser({ roles: [Role.DUTY_OFFICER] }))).toThrow(AuthorizationError);
  });
});
