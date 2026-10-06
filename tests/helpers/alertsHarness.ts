import { InMemoryErrorLog } from '@/core/shared/ErrorLog';
import { InMemoryRepository } from '@/core/shared/Repository';
import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { Role, type UserAccount } from '@/core/users/UserAccount';
import { AlertBroadcaster } from '@/modules/alerts/application/AlertBroadcaster';
import { AlertDraftValidator, type AlertDraft } from '@/modules/alerts/application/AlertDraft';
import { AlertService } from '@/modules/alerts/application/AlertService';
import type { VerifiedReportFeed } from '@/modules/alerts/application/VerifiedReportFeed';
import { AlertMessageFormatter } from '@/modules/alerts/channels/AlertMessageFormatter';
import { SeverityBasedChannelPolicy } from '@/modules/alerts/channels/ChannelSelectionPolicy';
import { PushNotificationChannel } from '@/modules/alerts/channels/PushNotificationChannel';
import { SimulatedSmsGateway, SmsChannel } from '@/modules/alerts/channels/SmsChannel';
import type { DeliveryRecord } from '@/modules/alerts/domain/DeliveryRecord';
import type { HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import { makeUser, testKernel } from './fixtures';

export const dmcOfficer = () => makeUser({ roles: [Role.DMC_OFFICER] });

export function validDraft(overrides: Partial<AlertDraft> = {}): AlertDraft {
  return {
    hazardTypeCode: 'FLOOD',
    severity: SeverityLevel.WARNING,
    title: 'Kelani River Basin Spillover',
    description: 'Water levels are rising at Hanwella. Prepare to evacuate.',
    targetScope: 'DISTRICT',
    targetIds: ['COL'],
    validityHours: 24,
    ...overrides,
  };
}

/** Builds the full UC01 object graph with in-memory adapters. */
export function alertsHarness(users: UserAccount[] = []) {
  const k = testKernel(users);
  const sms = new SimulatedSmsGateway();
  const alerts = new InMemoryRepository<HazardAlert>();
  const deliveries = new InMemoryRepository<DeliveryRecord>();
  const errorLog = new InMemoryErrorLog();
  const verifiedReports: VerifiedReportFeed = { listVerified: vi.fn(() => []) };
  const policy = new SeverityBasedChannelPolicy();
  const formatter = new AlertMessageFormatter(k.geo, k.hazardTypes);
  const broadcaster = new AlertBroadcaster(
    [new PushNotificationChannel(k.inbox, k.connectivity), new SmsChannel(sms)],
    policy,
    formatter,
    deliveries,
    k.users,
    k.ids,
    k.clock,
  );
  const service = new AlertService({
    alerts,
    validator: new AlertDraftValidator(k.hazardTypes),
    broadcaster,
    policy,
    users: k.users,
    verifiedReports,
    geo: k.geo,
    hazardTypes: k.hazardTypes,
    ids: k.ids,
    clock: k.clock,
    events: k.events,
    errorLog,
  });
  return { ...k, sms, alerts, deliveries, errorLog, verifiedReports, policy, formatter, broadcaster, service };
}
