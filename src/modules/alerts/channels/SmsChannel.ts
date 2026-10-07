import type { UserAccount } from '@/core/users/UserAccount';
import type { AlertMessage, DeliveryOutcome, NotificationChannel } from './NotificationChannel';

/** Port to an external SMS provider (e.g. a mobile operator's bulk SMS API). */
export interface SmsGateway {
  send(phoneNumber: string, text: string): Promise<DeliveryOutcome>;
}

export class SmsChannel implements NotificationChannel {
  readonly kind = 'SMS' as const;

  constructor(private readonly gateway: SmsGateway) {}

  canReach(recipient: UserAccount): boolean {
    return recipient.phone.trim().length > 0;
  }

  send(message: AlertMessage, recipient: UserAccount): Promise<DeliveryOutcome> {
    return this.gateway.send(recipient.phone, message.shortText);
  }
}

export interface SentSms {
  readonly phoneNumber: string;
  readonly text: string;
}

/** Mock SMS provider (the assignment allows simulating external hardware/services). */
export class SimulatedSmsGateway implements SmsGateway {
  private available = true;
  private readonly sent: SentSms[] = [];

  setAvailable(available: boolean): void {
    this.available = available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  sentMessages(): readonly SentSms[] {
    return [...this.sent];
  }

  async send(phoneNumber: string, text: string): Promise<DeliveryOutcome> {
    if (!this.available) {
      return { delivered: false, reason: 'SMS gateway unavailable' };
    }
    this.sent.push({ phoneNumber, text });
    return { delivered: true };
  }
}
