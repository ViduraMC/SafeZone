import { DomainError } from '@/core/shared/errors';

export type ChannelKind = 'PUSH' | 'SMS';

export enum DeliveryStatus {
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  /** Recipient not reached on any channel yet; retried when connectivity returns. */
  QUEUED = 'QUEUED',
}

/** One delivery attempt history for a recipient on a channel. */
export class DeliveryRecord {
  private _status: DeliveryStatus;
  private _attempts = 1;
  private _lastAttemptAt: Date;
  private _failureReason?: string;
  private _deliveredAt?: Date;

  constructor(
    readonly id: string,
    readonly alertId: string,
    readonly recipientId: string,
    readonly districtId: string,
    readonly channel: ChannelKind,
    status: DeliveryStatus,
    at: Date,
    failureReason?: string,
  ) {
    this._status = status;
    this._lastAttemptAt = at;
    this._failureReason = failureReason;
    if (status === DeliveryStatus.DELIVERED) this._deliveredAt = at;
  }

  get status(): DeliveryStatus {
    return this._status;
  }

  get attempts(): number {
    return this._attempts;
  }

  get lastAttemptAt(): Date {
    return this._lastAttemptAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  get failureReason(): string | undefined {
    return this._failureReason;
  }

  recordRetrySuccess(at: Date): void {
    this.requireQueued();
    this._attempts += 1;
    this._status = DeliveryStatus.DELIVERED;
    this._lastAttemptAt = at;
    this._deliveredAt = at;
    this._failureReason = undefined;
  }

  recordRetryFailure(at: Date, reason: string): void {
    this.requireQueued();
    this._attempts += 1;
    this._lastAttemptAt = at;
    this._failureReason = reason;
  }

  private requireQueued(): void {
    if (this._status !== DeliveryStatus.QUEUED) {
      throw new DomainError('Only queued deliveries can be retried');
    }
  }
}
