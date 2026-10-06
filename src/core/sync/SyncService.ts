import type { Clock } from '../shared/Clock';
import type { EventBus } from '../shared/EventBus';
import type { IdGenerator } from '../shared/IdGenerator';
import type { Repository } from '../shared/Repository';
import type { ConnectivityMonitor } from './Connectivity';

/** A change captured on the device while offline, waiting to reach the central server. */
export interface PendingSyncItem {
  readonly id: string;
  /** Item category, e.g. `ground-report` or `field-update`; selects the handler. */
  readonly kind: string;
  readonly entityId: string;
  readonly description: string;
  readonly createdAt: Date;
  attempts: number;
  lastError?: string;
}

/** Port to the central SafeZone server. */
export interface RemoteSyncGateway {
  push(item: PendingSyncItem): Promise<void>;
}

/**
 * Callback run after an item reaches the server. Each module registers its own
 * handler, so new offline-capable features plug in without changing this class.
 */
export interface SyncHandler {
  readonly kind: string;
  onSynced(item: PendingSyncItem): void;
}

export interface SyncSummary {
  readonly synced: number;
  readonly failed: number;
  readonly remaining: number;
}

export const SYNC_COMPLETED_EVENT = 'sync.completed';

/**
 * Offline outbox with delayed synchronisation. The original class diagram had
 * no abstraction for this even though offline capture appears in UC01-UC03.
 */
export class SyncService {
  private readonly handlers = new Map<string, SyncHandler>();
  private flushing: Promise<SyncSummary> | null = null;

  constructor(
    private readonly outbox: Repository<PendingSyncItem>,
    private readonly gateway: RemoteSyncGateway,
    private readonly connectivity: ConnectivityMonitor,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  registerHandler(handler: SyncHandler): void {
    this.handlers.set(handler.kind, handler);
  }

  enqueue(kind: string, entityId: string, description: string): PendingSyncItem {
    return this.outbox.save({
      id: this.ids.next('SYNC'),
      kind,
      entityId,
      description,
      createdAt: this.clock.now(),
      attempts: 0,
    });
  }

  pending(): PendingSyncItem[] {
    return this.outbox.findAll().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /** Re-attempts synchronisation automatically whenever connectivity returns. */
  startAutoSync(): () => void {
    return this.connectivity.onChange((online) => {
      if (online) void this.flush();
    });
  }

  /** Pushes pending items in order; failures stay in the outbox for the next attempt. */
  flush(): Promise<SyncSummary> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush(): Promise<SyncSummary> {
    if (!this.connectivity.isOnline()) {
      return { synced: 0, failed: 0, remaining: this.outbox.count() };
    }
    let synced = 0;
    let failed = 0;
    for (const item of this.pending()) {
      item.attempts += 1;
      try {
        await this.gateway.push(item);
        this.outbox.delete(item.id);
        this.handlers.get(item.kind)?.onSynced(item);
        synced += 1;
      } catch (error) {
        item.lastError = error instanceof Error ? error.message : String(error);
        this.outbox.save(item);
        failed += 1;
      }
    }
    const summary = { synced, failed, remaining: this.outbox.count() };
    this.events.publish({ type: SYNC_COMPLETED_EVENT, occurredAt: this.clock.now(), payload: { ...summary } });
    return summary;
  }
}
