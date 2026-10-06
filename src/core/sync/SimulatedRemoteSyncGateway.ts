import type { PendingSyncItem, RemoteSyncGateway } from './SyncService';

/** Stand-in for the central server. Can be told to reject pushes to demo UC03 E4. */
export class SimulatedRemoteSyncGateway implements RemoteSyncGateway {
  private failuresRemaining = 0;
  private readonly received: PendingSyncItem[] = [];

  failNext(times = 1): void {
    this.failuresRemaining = times;
  }

  receivedItems(): readonly PendingSyncItem[] {
    return [...this.received];
  }

  async push(item: PendingSyncItem): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('Central server did not acknowledge the update');
    }
    this.received.push({ ...item });
  }
}
