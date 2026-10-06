import { SimulatedConnectivity } from '@/core/sync/Connectivity';
import { SYNC_COMPLETED_EVENT } from '@/core/sync/SyncService';
import { testKernel } from '../helpers/fixtures';

describe('SimulatedConnectivity', () => {
  it('notifies listeners only on real changes', () => {
    const connectivity = new SimulatedConnectivity(true);
    const listener = vi.fn();
    const stop = connectivity.onChange(listener);
    connectivity.setOnline(true);
    connectivity.setOnline(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(false);
    stop();
    connectivity.setOnline(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(connectivity.isOnline()).toBe(true);
  });
});

describe('SyncService (offline outbox)', () => {
  it('keeps items while offline and does not contact the server', async () => {
    const k = testKernel();
    k.connectivity.setOnline(false);
    k.sync.enqueue('ground-report', 'RPT-1', 'Report 1');

    const summary = await k.sync.flush();

    expect(summary).toEqual({ synced: 0, failed: 0, remaining: 1 });
    expect(k.remote.receivedItems()).toHaveLength(0);
  });

  it('pushes pending items in order, runs the matching handler and empties the outbox', async () => {
    const k = testKernel();
    const handler = { kind: 'ground-report', onSynced: vi.fn() };
    k.sync.registerHandler(handler);
    k.sync.enqueue('ground-report', 'RPT-1', 'first');
    k.clock.advanceMinutes(1);
    k.sync.enqueue('field-update', 'SHL-1', 'second (no handler)');

    const summary = await k.sync.flush();

    expect(summary).toEqual({ synced: 2, failed: 0, remaining: 0 });
    expect(k.remote.receivedItems().map((i) => i.entityId)).toEqual(['RPT-1', 'SHL-1']);
    expect(handler.onSynced).toHaveBeenCalledTimes(1);
    expect(k.published.some((e) => e.type === SYNC_COMPLETED_EVENT)).toBe(true);
  });

  it('retains items the server rejects and records the error (UC03 E4)', async () => {
    const k = testKernel();
    k.sync.enqueue('field-update', 'SHL-1', 'update');
    k.remote.failNext(1);

    const failed = await k.sync.flush();
    expect(failed).toEqual({ synced: 0, failed: 1, remaining: 1 });
    expect(k.sync.pending()[0]).toMatchObject({ attempts: 1, lastError: 'Central server did not acknowledge the update' });

    const retried = await k.sync.flush();
    expect(retried.synced).toBe(1);
    expect(k.sync.pending()).toHaveLength(0);
  });

  it('records non-Error rejections as text', async () => {
    const k = testKernel();
    const gatewayThrowingString = { push: () => Promise.reject('timeout') };
    const { SyncService } = await import('@/core/sync/SyncService');
    const sync = new SyncService(k.outbox, gatewayThrowingString, k.connectivity, k.ids, k.clock, k.events);
    sync.enqueue('x', 'E1', 'item');
    await sync.flush();
    expect(sync.pending()[0].lastError).toBe('timeout');
  });

  it('synchronises automatically when connectivity is restored', async () => {
    const k = testKernel();
    const stop = k.sync.startAutoSync();
    k.connectivity.setOnline(false);
    k.sync.enqueue('field-update', 'SHL-1', 'update');

    k.connectivity.setOnline(true);
    await vi.waitFor(() => expect(k.sync.pending()).toHaveLength(0));
    stop();
  });

  it('shares a single flush when called concurrently', async () => {
    const k = testKernel();
    k.sync.enqueue('x', 'E1', 'item');
    const [a, b] = await Promise.all([k.sync.flush(), k.sync.flush()]);
    expect(a).toBe(b);
    expect(k.remote.receivedItems()).toHaveLength(1);
  });
});
