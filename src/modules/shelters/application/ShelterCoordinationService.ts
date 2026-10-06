import type { Coordinates } from '@/core/geo/District';
import { distanceKm, type GeoDirectory } from '@/core/geo/GeoDirectory';
import type { InboxService } from '@/core/notifications/Inbox';
import type { Clock } from '@/core/shared/Clock';
import { NotFoundError } from '@/core/shared/errors';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import { FieldErrors, isBlank } from '@/core/shared/Validator';
import { Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { UserDirectory } from '@/core/users/UserDirectory';
import type { OccupancySnapshot } from '../domain/OccupancySnapshot';
import { Shelter, ShelterStatus } from '../domain/Shelter';
import type { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';

export interface ShelterRegistration {
  readonly name: string;
  readonly districtId: string;
  readonly address: string;
  readonly capacity: number;
  readonly ownerId: string;
  readonly contactPhone: string;
  readonly facilities: readonly string[];
}

export interface AllocationResult {
  readonly shelter: Shelter;
  /** A1: the allocation pushed the shelter to NEAR_CAPACITY or FULL. */
  readonly capacityWarning: boolean;
  readonly storedOffline: boolean;
}

export interface NearbyShelter {
  readonly shelter: Shelter;
  readonly distanceKm: number;
}

export const MAX_SHELTER_CAPACITY = 10_000;
/** Evacuees are only redirected to shelters within a realistic travel distance. */
export const MAX_ALTERNATIVE_DISTANCE_KM = 40;

/** UC03 Coordinate Emergency Shelters: register, allocate, release and handle closures. */
export class ShelterCoordinationService {
  constructor(
    private readonly shelters: Repository<Shelter>,
    private readonly snapshots: Repository<OccupancySnapshot>,
    private readonly updates: FieldUpdateRecorder,
    private readonly inbox: InboxService,
    private readonly users: UserDirectory,
    private readonly geo: GeoDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Shelters of a district, ordered by most remaining capacity first. */
  sheltersInDistrict(districtId: string): Shelter[] {
    return this.shelters
      .findWhere((shelter) => shelter.districtId === districtId)
      .sort((a, b) => b.remainingCapacity - a.remainingCapacity);
  }

  /** Citizen "Find Nearest Shelter": open shelters with space first, then by distance. */
  nearest(point: Coordinates, limit = 10): NearbyShelter[] {
    return this.shelters
      .findAll()
      .map((shelter) => ({ shelter, distanceKm: distanceKm(point, shelter.location) }))
      .sort((a, b) => Number(!hasSpace(a.shelter)) - Number(!hasSpace(b.shelter)) || a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }

  getShelter(shelterId: string): Shelter {
    const shelter = this.shelters.findById(shelterId);
    if (!shelter) throw new NotFoundError('Shelter', shelterId);
    return shelter;
  }

  /** A2: register a new shelter (e.g. a school opened for the event). */
  registerShelter(input: ShelterRegistration, officer: UserAccount): Shelter {
    requireRole(officer, Role.DISTRICT_OFFICER);
    new FieldErrors()
      .require(!isBlank(input.name), 'name', 'Enter the shelter name')
      .require(this.geo.findDistrict(input.districtId) !== undefined, 'districtId', 'Select a district')
      .require(!isBlank(input.address), 'address', 'Enter the address')
      .require(Number.isInteger(input.capacity) && input.capacity > 0, 'capacity', 'Capacity must be a whole number above zero')
      .require(input.capacity <= MAX_SHELTER_CAPACITY, 'capacity', `Capacity cannot exceed ${MAX_SHELTER_CAPACITY}`)
      .require(!isBlank(input.ownerId), 'ownerId', 'Select the managing organisation')
      .throwIfAny();

    const shelter = new Shelter({
      ...input,
      id: this.ids.next('SHL'),
      name: input.name.trim(),
      address: input.address.trim(),
      location: this.geo.getDistrict(input.districtId).centroid,
    });
    this.shelters.save(shelter);
    this.snapshot(shelter);
    this.updates.record(shelter.id, `Registered shelter ${shelter.name}`);
    return shelter;
  }

  /** Steps 6-8: allocate evacuees. Throws ShelterCapacityError when too few places remain (E1). */
  allocate(shelterId: string, people: number, officer: UserAccount): AllocationResult {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const shelter = this.getShelter(shelterId);
    shelter.admit(people);
    this.shelters.save(shelter);
    this.snapshot(shelter);
    const storedOffline = this.updates.record(shelter.id, `Allocated ${people} people to ${shelter.name}`);
    const capacityWarning = shelter.status === ShelterStatus.NEAR_CAPACITY || shelter.status === ShelterStatus.FULL;
    return { shelter, capacityWarning, storedOffline };
  }

  /** A3: evacuees leave the shelter (e.g. return home after the water recedes). */
  release(shelterId: string, people: number, officer: UserAccount): Shelter {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const shelter = this.getShelter(shelterId);
    shelter.release(people);
    this.shelters.save(shelter);
    this.snapshot(shelter);
    this.updates.record(shelter.id, `Released ${people} people from ${shelter.name}`);
    return shelter;
  }

  /** A1 / E1 / E2: nearby shelters (within 40 km) that can take the given number of people, nearest first. */
  alternatives(shelterId: string, people: number): Shelter[] {
    const origin = this.getShelter(shelterId);
    return this.shelters
      .findWhere((s) => s.id !== origin.id && s.isAvailable && s.remainingCapacity >= Math.max(1, people))
      .map((shelter) => ({ shelter, km: distanceKm(origin.location, shelter.location) }))
      .filter(({ km }) => km <= MAX_ALTERNATIVE_DISTANCE_KM)
      .sort((a, b) => a.km - b.km)
      .map(({ shelter }) => shelter);
  }

  /** E2: the shelter can no longer be used; district officers are notified. */
  markUnavailable(shelterId: string, reason: string, officer: UserAccount): Shelter[] {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const shelter = this.getShelter(shelterId);
    shelter.markUnavailable(reason);
    this.shelters.save(shelter);
    this.updates.record(shelter.id, `${shelter.name} marked unavailable`);
    this.users
      .findByRole(Role.DISTRICT_OFFICER)
      .filter((user) => user.homeDistrictId === shelter.districtId)
      .forEach((user) =>
        this.inbox.deliver({
          userId: user.id,
          kind: 'SYSTEM',
          title: `${shelter.name} is unavailable`,
          body: `Reason: ${reason.trim()}. Select an alternative shelter for ${shelter.occupancy} evacuees.`,
          link: `/coordination/shelters/${shelter.id}`,
        }),
      );
    return this.alternatives(shelter.id, shelter.occupancy);
  }

  /** A4: a closed shelter becomes usable again. */
  reopen(shelterId: string, officer: UserAccount): Shelter {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const shelter = this.getShelter(shelterId);
    shelter.reopen();
    this.shelters.save(shelter);
    this.updates.record(shelter.id, `${shelter.name} reopened`);
    return shelter;
  }

  private snapshot(shelter: Shelter): void {
    this.snapshots.save({
      id: this.ids.next('OCC'),
      shelterId: shelter.id,
      districtId: shelter.districtId,
      occupancy: shelter.occupancy,
      capacity: shelter.capacity,
      at: this.clock.now(),
    });
  }
}

function hasSpace(shelter: Shelter): boolean {
  return shelter.isAvailable && shelter.remainingCapacity > 0;
}
