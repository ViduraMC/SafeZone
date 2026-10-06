import type { InboxService } from '@/core/notifications/Inbox';
import type { ConnectivityMonitor } from '@/core/sync/Connectivity';
import type { UserAccount } from '@/core/users/UserAccount';
import type { AlertMessage, DeliveryOutcome, NotificationChannel } from './NotificationChannel';

/** Delivers alerts as in-app push notifications; needs a smartphone and a data network. */
export class PushNotificationChannel implements NotificationChannel {
  readonly kind = 'PUSH' as const;

  constructor(
    private readonly inbox: InboxService,
    private readonly dataNetwork: ConnectivityMonitor,
  ) {}

  canReach(recipient: UserAccount): boolean {
    return recipient.contact.hasSmartphone;
  }

  async send(message: AlertMessage, recipient: UserAccount): Promise<DeliveryOutcome> {
    if (!this.dataNetwork.isOnline()) {
      return { delivered: false, reason: 'Push network unavailable' };
    }
    this.inbox.deliver({
      userId: recipient.id,
      kind: 'ALERT',
      title: message.title,
      body: message.body,
      link: `/alerts/${message.alertId}`,
      audibleOverride: message.audibleOverride,
    });
    return { delivered: true };
  }
}
