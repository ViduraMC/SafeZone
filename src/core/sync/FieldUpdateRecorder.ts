import type { Clock } from '@/core/shared/Clock';
import type { EventBus } from '@/core/shared/EventBus';
import type { ConnectivityMonitor } from '@/core/sync/Connectivity';
import type { PendingSyncItem, SyncHandler, SyncService } from '@/core/sync/SyncService';

export const FIELD_UPDATE_SYNC_KIND = 'field-update';
export const COORDINATION_UPDATED_EVENT = 'coordination.updated';

/**
 * Records every coordination change made in the field. While offline the
 * change is kept in the outbox and pushed later (UC03 E3/E4 and UC04 E2).
 */
export class FieldUpdateRecorder implements SyncHandler {
  readonly kind = FIELD_UPDATE_SYNC_KIND;

  constructor(
    private readonly connectivity: ConnectivityMonitor,
    private readonly sync: SyncService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  /** Returns true when the update was stored locally for later synchronisation. */
  record(entityId: string, description: string): boolean {
    const offline = !this.connectivity.isOnline();
    if (offline) this.sync.enqueue(FIELD_UPDATE_SYNC_KIND, entityId, description);
    this.events.publish({
      type: COORDINATION_UPDATED_EVENT,
      occurredAt: this.clock.now(),
      payload: { entityId, description, storedOffline: offline },
    });
    return offline;
  }

  onSynced(item: PendingSyncItem): void {
    this.events.publish({ type: COORDINATION_UPDATED_EVENT, occurredAt: this.clock.now(), payload: { entityId: item.entityId, synced: true } });
  }
}
