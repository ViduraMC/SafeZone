import { StaticGeoDirectory } from '@/core/geo/GeoDirectory';
import { SRI_LANKA_DISTRICTS, SRI_LANKA_RIVER_BASINS } from '@/core/geo/sriLankaGeography';
import { DEFAULT_HAZARD_TYPES, HazardTypeRegistry } from '@/core/hazard/HazardType';
import { InboxService, type InboxMessage } from '@/core/notifications/Inbox';
import { ManualClock } from '@/core/shared/Clock';
import { InMemoryEventBus, type DomainEvent } from '@/core/shared/EventBus';
import { SequentialIdGenerator } from '@/core/shared/IdGenerator';
import { InMemoryRepository } from '@/core/shared/Repository';
import { SimulatedConnectivity } from '@/core/sync/Connectivity';
import { SimulatedRemoteSyncGateway } from '@/core/sync/SimulatedRemoteSyncGateway';
import { SyncService, type PendingSyncItem } from '@/core/sync/SyncService';
import { Role, type UserAccount } from '@/core/users/UserAccount';
import { RepositoryUserDirectory } from '@/core/users/UserDirectory';

export const T0 = new Date('2026-10-06T08:00:00Z');

let userCounter = 0;

/** Builds a user with sensible defaults; override only what the test cares about. */
export function makeUser(overrides: Partial<UserAccount> = {}): UserAccount {
  userCounter += 1;
  return {
    id: `U${userCounter}`,
    name: `User ${userCounter}`,
    phone: `+94 77 000 ${String(userCounter).padStart(4, '0')}`,
    homeDistrictId: 'COL',
    roles: [Role.CITIZEN],
    contact: { hasSmartphone: true, smsOptIn: true },
    ...overrides,
  };
}

export const geo = () => new StaticGeoDirectory(SRI_LANKA_DISTRICTS, SRI_LANKA_RIVER_BASINS);
export const hazardTypes = () => new HazardTypeRegistry(DEFAULT_HAZARD_TYPES);

/** Shared infrastructure every service test needs, all in-memory and deterministic. */
export function testKernel(users: UserAccount[] = []) {
  const clock = new ManualClock(T0);
  const ids = new SequentialIdGenerator();
  const events = new InMemoryEventBus();
  const published: DomainEvent[] = [];
  events.subscribeAll((event) => published.push(event));
  const userRepo = new InMemoryRepository<UserAccount>(users);
  const connectivity = new SimulatedConnectivity(true);
  const remote = new SimulatedRemoteSyncGateway();
  const outbox = new InMemoryRepository<PendingSyncItem>();
  const inboxRepo = new InMemoryRepository<InboxMessage>();
  return {
    clock,
    ids,
    events,
    published,
    userRepo,
    users: new RepositoryUserDirectory(userRepo),
    connectivity,
    remote,
    outbox,
    sync: new SyncService(outbox, remote, connectivity, ids, clock, events),
    inbox: new InboxService(inboxRepo, ids, clock),
    geo: geo(),
    hazardTypes: hazardTypes(),
  };
}
