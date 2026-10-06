import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { UserAccount } from '@/core/users/UserAccount';
import type { ChannelKind } from '../domain/DeliveryRecord';

export interface ChannelPlan {
  /** Channels to use, in priority order. */
  readonly channels: readonly ChannelKind[];
  readonly audibleOverride: boolean;
}

/**
 * Strategy that decides how a recipient is contacted (Open/Closed fix). The
 * original design implied an if/else on severity inside broadcast(); a
 * different policy can now be supplied without modifying the broadcaster.
 */
export interface ChannelSelectionPolicy {
  plan(severity: SeverityLevel, recipient: UserAccount): ChannelPlan;
}

/**
 * Default policy derived from the UC01 scenario (A4 "Multiple Alert Channels"):
 * - ADVISORY  -> push (SMS only for people without a smartphone or who opted in)
 * - WARNING   -> push + SMS
 * - EMERGENCY -> push + SMS, with the audible emergency override.
 */
export class SeverityBasedChannelPolicy implements ChannelSelectionPolicy {
  plan(severity: SeverityLevel, recipient: UserAccount): ChannelPlan {
    const channels: ChannelKind[] = [];
    if (recipient.contact.hasSmartphone) channels.push('PUSH');
    if (this.shouldUseSms(severity, recipient)) channels.push('SMS');
    return { channels, audibleOverride: severity === SeverityLevel.EMERGENCY };
  }

  private shouldUseSms(severity: SeverityLevel, recipient: UserAccount): boolean {
    if (!recipient.contact.hasSmartphone) return true;
    if (severity === SeverityLevel.ADVISORY) return recipient.contact.smsOptIn;
    return true;
  }
}
