import type { SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { UserAccount } from '@/core/users/UserAccount';
import type { ChannelKind } from '../domain/DeliveryRecord';

/** Channel-neutral content of an alert, produced once by AlertMessageFormatter. */
export interface AlertContent {
  readonly alertId: string;
  readonly severity: SeverityLevel;
  readonly title: string;
  readonly body: string;
  /** Short form for SMS (160 characters max). */
  readonly shortText: string;
}

/** Content plus the presentation decided by the ChannelSelectionPolicy. */
export interface AlertMessage extends AlertContent {
  /** Device should sound the emergency override (presentation mode, not a channel). */
  readonly audibleOverride: boolean;
}

export interface DeliveryOutcome {
  readonly delivered: boolean;
  readonly reason?: string;
}

/**
 * Delivery channel contract. Every implementation means the same thing by a
 * successful send: the message reached the recipient's device (Liskov fix -
 * the audible alert is no longer a "channel", it is a presentation mode of push).
 */
export interface NotificationChannel {
  readonly kind: ChannelKind;
  /** Whether this recipient can be contacted on this channel at all. */
  canReach(recipient: UserAccount): boolean;
  send(message: AlertMessage, recipient: UserAccount): Promise<DeliveryOutcome>;
}
