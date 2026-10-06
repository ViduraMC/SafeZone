import type { Clock } from '@/core/shared/Clock';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import type { UserAccount } from '@/core/users/UserAccount';
import type { UserDirectory } from '@/core/users/UserDirectory';
import { DeliveryRecord, DeliveryStatus, type ChannelKind } from '../domain/DeliveryRecord';
import type { HazardAlert } from '../domain/HazardAlert';
import type { AlertMessageFormatter } from '../channels/AlertMessageFormatter';
import type { ChannelSelectionPolicy } from '../channels/ChannelSelectionPolicy';
import type { AlertMessage, NotificationChannel } from '../channels/NotificationChannel';

export interface ChannelTally {
  delivered: number;
  failed: number;
}

export interface BroadcastSummary {
  readonly recipients: number;
  readonly reached: number;
  readonly queued: number;
  readonly byChannel: Readonly<Record<ChannelKind, ChannelTally>>;
}

export interface RetrySummary {
  readonly retried: number;
  readonly delivered: number;
  readonly stillQueued: number;
}

/**
 * Delivers an alert to recipients over the channels chosen by the policy, falls
 * back to alternative channels, and queues anyone it could not reach
 * (UC01 steps 12-15 and E2). Extracted from HazardAlert.broadcast() and
 * DeliveryRecord.queuePendingDelivery() in the original design.
 */
export class AlertBroadcaster {
  private readonly channels: Map<ChannelKind, NotificationChannel>;

  constructor(
    channels: readonly NotificationChannel[],
    private readonly policy: ChannelSelectionPolicy,
    private readonly formatter: AlertMessageFormatter,
    private readonly deliveries: Repository<DeliveryRecord>,
    private readonly users: UserDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    this.channels = new Map(channels.map((channel) => [channel.kind, channel]));
  }

  async broadcast(alert: HazardAlert, recipients: readonly UserAccount[], isUpdate = false): Promise<BroadcastSummary> {
    const content = this.formatter.format(alert, isUpdate);
    const byChannel = emptyTally();
    let reached = 0;
    let queued = 0;

    for (const recipient of recipients) {
      const plan = this.policy.plan(alert.severity, recipient);
      const message: AlertMessage = { ...content, audibleOverride: plan.audibleOverride };
      const delivered = await this.deliverWithFallback(alert, recipient, message, plan.channels, byChannel);
      if (delivered) {
        reached += 1;
      } else {
        this.queue(alert, recipient, plan.channels[0] ?? 'SMS');
        queued += 1;
      }
    }
    return { recipients: recipients.length, reached, queued, byChannel };
  }

  /** Retries every queued delivery (called when connectivity is restored). */
  async retryQueued(alertLookup: (alertId: string) => HazardAlert | undefined): Promise<RetrySummary> {
    const queued = this.deliveries.findWhere((record) => record.status === DeliveryStatus.QUEUED);
    let delivered = 0;
    for (const record of queued) {
      const alert = alertLookup(record.alertId);
      const channel = this.channels.get(record.channel);
      if (!alert || !channel) continue;
      const recipient = this.users.get(record.recipientId);
      const plan = this.policy.plan(alert.severity, recipient);
      const outcome = await channel.send({ ...this.formatter.format(alert), audibleOverride: plan.audibleOverride }, recipient);
      if (outcome.delivered) {
        record.recordRetrySuccess(this.clock.now());
        delivered += 1;
      } else {
        record.recordRetryFailure(this.clock.now(), outcome.reason ?? 'Unknown failure');
      }
      this.deliveries.save(record);
    }
    return { retried: queued.length, delivered, stillQueued: queued.length - delivered };
  }

  deliveriesFor(alertId: string): DeliveryRecord[] {
    return this.deliveries.findWhere((record) => record.alertId === alertId);
  }

  private async deliverWithFallback(
    alert: HazardAlert,
    recipient: UserAccount,
    message: AlertMessage,
    planned: readonly ChannelKind[],
    tally: Record<ChannelKind, ChannelTally>,
  ): Promise<boolean> {
    let delivered = false;
    for (const kind of planned) {
      delivered = (await this.attempt(alert, recipient, message, kind, tally)) || delivered;
    }
    if (delivered) return true;

    // E2: planned channels failed, so try any other channel that can reach the person.
    for (const channel of this.channels.values()) {
      if (planned.includes(channel.kind) || !channel.canReach(recipient)) continue;
      if (await this.attempt(alert, recipient, message, channel.kind, tally)) return true;
    }
    return false;
  }

  private async attempt(
    alert: HazardAlert,
    recipient: UserAccount,
    message: AlertMessage,
    kind: ChannelKind,
    tally: Record<ChannelKind, ChannelTally>,
  ): Promise<boolean> {
    const channel = this.channels.get(kind);
    if (!channel || !channel.canReach(recipient)) return false;
    const outcome = await channel.send(message, recipient);
    const status = outcome.delivered ? DeliveryStatus.DELIVERED : DeliveryStatus.FAILED;
    this.record(alert, recipient, kind, status, outcome.reason);
    tally[kind][outcome.delivered ? 'delivered' : 'failed'] += 1;
    return outcome.delivered;
  }

  private queue(alert: HazardAlert, recipient: UserAccount, channel: ChannelKind): void {
    this.record(alert, recipient, channel, DeliveryStatus.QUEUED, 'No channel reachable; queued for retry');
  }

  private record(alert: HazardAlert, recipient: UserAccount, channel: ChannelKind, status: DeliveryStatus, reason?: string): void {
    this.deliveries.save(
      new DeliveryRecord(this.ids.next('DLV'), alert.id, recipient.id, recipient.homeDistrictId, channel, status, this.clock.now(), reason),
    );
  }
}

function emptyTally(): Record<ChannelKind, ChannelTally> {
  return { PUSH: { delivered: 0, failed: 0 }, SMS: { delivered: 0, failed: 0 } };
}
