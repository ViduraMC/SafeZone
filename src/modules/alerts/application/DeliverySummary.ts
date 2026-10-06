import { DeliveryStatus, type ChannelKind, type DeliveryRecord } from '../domain/DeliveryRecord';

export interface DeliverySummary {
  readonly recipients: number;
  readonly reached: number;
  readonly queued: number;
  readonly failedAttempts: number;
  readonly deliveredByChannel: Readonly<Record<ChannelKind, number>>;
}

/** Aggregates delivery records into the figures shown on the delivery monitoring screen. */
export function summariseDeliveries(records: readonly DeliveryRecord[]): DeliverySummary {
  const recipients = new Set<string>();
  const reached = new Set<string>();
  const queued = new Set<string>();
  const deliveredByChannel: Record<ChannelKind, number> = { PUSH: 0, SMS: 0 };
  let failedAttempts = 0;

  for (const record of records) {
    recipients.add(record.recipientId);
    if (record.status === DeliveryStatus.DELIVERED) {
      reached.add(record.recipientId);
      deliveredByChannel[record.channel] += 1;
    } else if (record.status === DeliveryStatus.QUEUED) {
      queued.add(record.recipientId);
    } else {
      failedAttempts += 1;
    }
  }
  return {
    recipients: recipients.size,
    reached: reached.size,
    queued: [...queued].filter((id) => !reached.has(id)).length,
    failedAttempts,
    deliveredByChannel,
  };
}
