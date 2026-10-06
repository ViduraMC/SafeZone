import type { Clock } from '../shared/Clock';
import type { IdGenerator } from '../shared/IdGenerator';
import type { Repository } from '../shared/Repository';

export type InboxMessageKind = 'ALERT' | 'REPORT_UPDATE' | 'TASK' | 'SYSTEM';

export interface InboxMessage {
  readonly id: string;
  readonly userId: string;
  readonly kind: InboxMessageKind;
  readonly title: string;
  readonly body: string;
  readonly createdAt: Date;
  /** Optional in-app route the message links to. */
  readonly link?: string;
  /** For alerts: whether the device should play the audible emergency override. */
  readonly audibleOverride?: boolean;
  read: boolean;
}

export interface NewInboxMessage {
  readonly userId: string;
  readonly kind: InboxMessageKind;
  readonly title: string;
  readonly body: string;
  readonly link?: string;
  readonly audibleOverride?: boolean;
}

/** In-app notification centre; the push channel and report updates deliver here. */
export class InboxService {
  constructor(
    private readonly messages: Repository<InboxMessage>,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  deliver(message: NewInboxMessage): InboxMessage {
    return this.messages.save({ ...message, id: this.ids.next('MSG'), createdAt: this.clock.now(), read: false });
  }

  forUser(userId: string): InboxMessage[] {
    return this.messages
      .findWhere((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  unreadCount(userId: string): number {
    return this.messages.findWhere((m) => m.userId === userId && !m.read).length;
  }

  markRead(messageId: string): void {
    const message = this.messages.findById(messageId);
    if (message) {
      message.read = true;
      this.messages.save(message);
    }
  }
}
