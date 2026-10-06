import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { addHours } from '@/core/shared/Clock';
import { AlertMessageFormatter, SMS_MAX_LENGTH, truncate } from '@/modules/alerts/channels/AlertMessageFormatter';
import { SeverityBasedChannelPolicy } from '@/modules/alerts/channels/ChannelSelectionPolicy';
import type { AlertMessage } from '@/modules/alerts/channels/NotificationChannel';
import { PushNotificationChannel } from '@/modules/alerts/channels/PushNotificationChannel';
import { SimulatedSmsGateway, SmsChannel } from '@/modules/alerts/channels/SmsChannel';
import { HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import { RiverBasinTarget } from '@/modules/alerts/domain/TargetArea';
import { geo, hazardTypes, makeUser, T0, testKernel } from '../helpers/fixtures';

const message: AlertMessage = {
  alertId: 'ALT-1',
  severity: SeverityLevel.EMERGENCY,
  title: 'EMERGENCY: Flood',
  body: 'Evacuate',
  shortText: 'SafeZone EMERGENCY Flood',
  audibleOverride: true,
};

describe('SeverityBasedChannelPolicy', () => {
  const policy = new SeverityBasedChannelPolicy();
  const smartphoneOptOut = makeUser({ contact: { hasSmartphone: true, smsOptIn: false } });
  const smartphoneOptIn = makeUser({ contact: { hasSmartphone: true, smsOptIn: true } });
  const basicPhone = makeUser({ contact: { hasSmartphone: false, smsOptIn: false } });

  it.each([
    ['advisory, opted out', SeverityLevel.ADVISORY, smartphoneOptOut, ['PUSH'], false],
    ['advisory, opted in', SeverityLevel.ADVISORY, smartphoneOptIn, ['PUSH', 'SMS'], false],
    ['warning', SeverityLevel.WARNING, smartphoneOptOut, ['PUSH', 'SMS'], false],
    ['emergency', SeverityLevel.EMERGENCY, smartphoneOptOut, ['PUSH', 'SMS'], true],
    ['basic phone always gets SMS', SeverityLevel.ADVISORY, basicPhone, ['SMS'], false],
  ])('%s', (_label, severity, recipient, channels, audible) => {
    expect(policy.plan(severity, recipient)).toEqual({ channels, audibleOverride: audible });
  });
});

describe('PushNotificationChannel', () => {
  it('delivers to the in-app inbox with the audible override flag', async () => {
    const k = testKernel();
    const user = makeUser();
    const push = new PushNotificationChannel(k.inbox, k.connectivity);

    await expect(push.send(message, user)).resolves.toEqual({ delivered: true });
    expect(k.inbox.forUser(user.id)[0]).toMatchObject({ kind: 'ALERT', audibleOverride: true, link: '/alerts/ALT-1' });
  });

  it('fails without a data network and cannot reach basic phones', async () => {
    const k = testKernel();
    k.connectivity.setOnline(false);
    const push = new PushNotificationChannel(k.inbox, k.connectivity);
    await expect(push.send(message, makeUser())).resolves.toEqual({ delivered: false, reason: 'Push network unavailable' });
    expect(push.canReach(makeUser({ contact: { hasSmartphone: false, smsOptIn: true } }))).toBe(false);
  });
});

describe('SmsChannel and SimulatedSmsGateway', () => {
  it('sends the short text to the recipient phone', async () => {
    const gateway = new SimulatedSmsGateway();
    const sms = new SmsChannel(gateway);
    const user = makeUser({ phone: '+94 77 111 2222' });

    await expect(sms.send(message, user)).resolves.toEqual({ delivered: true });
    expect(gateway.sentMessages()).toEqual([{ phoneNumber: '+94 77 111 2222', text: 'SafeZone EMERGENCY Flood' }]);
  });

  it('reports a failure when the gateway is down and cannot reach users without a phone', async () => {
    const gateway = new SimulatedSmsGateway();
    gateway.setAvailable(false);
    expect(gateway.isAvailable()).toBe(false);
    await expect(new SmsChannel(gateway).send(message, makeUser())).resolves.toMatchObject({ delivered: false });
    expect(new SmsChannel(gateway).canReach(makeUser({ phone: ' ' }))).toBe(false);
  });
});

describe('AlertMessageFormatter', () => {
  const alert = HazardAlert.draft({
    id: 'ALT-9',
    hazardTypeCode: 'FLOOD',
    title: 'Kalu Ganga flood',
    description: 'x'.repeat(300),
    severity: SeverityLevel.WARNING,
    target: new RiverBasinTarget('KALU'),
    validFrom: T0,
    validUntil: addHours(T0, 5),
    issuedBy: 'DMC',
  });
  const formatter = new AlertMessageFormatter(geo(), hazardTypes());

  it('includes hazard, area and severity and keeps SMS within 160 characters', () => {
    const content = formatter.format(alert);
    expect(content.title).toBe('WARNING: Kalu Ganga flood');
    expect(content.body).toContain('Flood - Kalu Ganga basin.');
    expect(content.shortText).toHaveLength(SMS_MAX_LENGTH);
    expect(content.shortText.endsWith('...')).toBe(true);
  });

  it('marks updates after escalation', () => {
    expect(formatter.format(alert, true).title).toBe('UPDATED WARNING: Kalu Ganga flood');
  });

  it('truncate leaves short text untouched', () => {
    expect(truncate('short', 10)).toBe('short');
  });
});
