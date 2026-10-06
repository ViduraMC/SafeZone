import { AuthorizationError, NotFoundError, ValidationError } from '@/core/shared/errors';
import { COORDINATION_UPDATED_EVENT, FIELD_UPDATE_SYNC_KIND } from '@/core/sync/FieldUpdateRecorder';
import { ShelterCapacityError, ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { makeUser } from '../helpers/fixtures';
import { coordinationHarness } from '../helpers/coordinationHarness';

describe('ShelterCoordinationService', () => {
  it('allocates evacuees, records an occupancy snapshot and publishes the update', () => {
    const h = coordinationHarness();
    const result = h.shelterService.allocate('SHL-A', 30, h.officer);

    expect(result).toMatchObject({ capacityWarning: false, storedOffline: false });
    expect(result.shelter.occupancy).toBe(30);
    expect(h.snapshots.findAll()).toMatchObject([{ shelterId: 'SHL-A', occupancy: 30, capacity: 100 }]);
    expect(h.published.some((e) => e.type === COORDINATION_UPDATED_EVENT)).toBe(true);
  });

  it('warns when a shelter becomes near capacity (A1)', () => {
    const h = coordinationHarness();
    expect(h.shelterService.allocate('SHL-A', 85, h.officer).capacityWarning).toBe(true);
  });

  it('suggests alternatives with enough space, nearest first, when a shelter is too full', () => {
    const h = coordinationHarness();
    expect(() => h.shelterService.allocate('SHL-C', 5, h.officer)).toThrow(ShelterCapacityError);
    expect(h.shelterService.alternatives('SHL-C', 5).map((s) => s.id)).toEqual(['SHL-A', 'SHL-B']);
    expect(h.shelterService.alternatives('SHL-A', 200).map((s) => s.id)).toEqual(['SHL-B']);
  });

  it('marks a shelter unavailable, notifies officers of that district and returns alternatives (E2)', () => {
    const h = coordinationHarness();
    h.shelterService.allocate('SHL-A', 20, h.officer);

    const alternatives = h.shelterService.markUnavailable('SHL-A', 'Water entered the hall', h.officer);

    expect(h.shelterService.getShelter('SHL-A').status).toBe(ShelterStatus.UNAVAILABLE);
    expect(alternatives.map((s) => s.id)).toEqual(['SHL-B']);
    expect(h.inbox.forUser(h.officer.id)[0].title).toBe('Kaduwela Community Hall is unavailable');
    expect(h.inbox.forUser(h.otherDistrictOfficer.id)).toHaveLength(0);
    expect(h.shelterService.reopen('SHL-A', h.officer).isAvailable).toBe(true);
  });

  it('releases evacuees and records the new occupancy', () => {
    const h = coordinationHarness();
    h.shelterService.allocate('SHL-B', 100, h.officer);
    expect(h.shelterService.release('SHL-B', 40, h.officer).occupancy).toBe(60);
    expect(h.snapshots.count()).toBe(2);
  });

  it('lists shelters of a district by remaining capacity and finds the nearest ones', () => {
    const h = coordinationHarness();
    expect(h.shelterService.sheltersInDistrict('COL').map((s) => s.id)).toEqual(['SHL-B', 'SHL-A', 'SHL-C']);
    h.shelterService.markUnavailable('SHL-A', 'closed', h.officer);
    const nearest = h.shelterService.nearest({ latitude: 6.9356, longitude: 79.9846 }, 2);
    expect(nearest.map((n) => n.shelter.id)).toEqual(['SHL-C', 'SHL-B']);
    expect(nearest[0].distanceKm).toBeGreaterThan(0);
  });

  it('registers a new shelter with validation', () => {
    const h = coordinationHarness();
    const input = { name: ' New Hall ', districtId: 'COL', address: 'Main St', capacity: 120, ownerId: 'OWN-GOV', contactPhone: '', facilities: [] };
    const created = h.shelterService.registerShelter(input, h.officer);
    expect(created).toMatchObject({ name: 'New Hall', capacity: 120, status: ShelterStatus.AVAILABLE });
    expect(created.id).toMatch(/^SHL-/);

    try {
      h.shelterService.registerShelter({ ...input, name: '', districtId: 'XX', capacity: 20_000, ownerId: '' }, h.officer);
      expect.unreachable();
    } catch (error) {
      expect(Object.keys((error as ValidationError).fieldErrors).sort()).toEqual(['capacity', 'districtId', 'name', 'ownerId']);
    }
  });

  it('restricts shelter changes to district officers', () => {
    const h = coordinationHarness();
    expect(() => h.shelterService.allocate('SHL-A', 1, makeUser())).toThrow(AuthorizationError);
    expect(() => h.shelterService.getShelter('SHL-404')).toThrow(NotFoundError);
  });
});

describe('offline field updates (UC03 E1 / E4)', () => {
  it('stores updates locally while offline and syncs them later', async () => {
    const h = coordinationHarness();
    h.connectivity.setOnline(false);
    const result = h.shelterService.allocate('SHL-A', 10, h.officer);
    h.rescue.dispatch('T-COL', { districtId: 'COL', locationDescription: 'Bridge' }, h.officer);

    expect(result.storedOffline).toBe(true);
    expect(h.sync.pending().map((i) => i.kind)).toEqual([FIELD_UPDATE_SYNC_KIND, FIELD_UPDATE_SYNC_KIND]);

    h.connectivity.setOnline(true);
    h.remote.failNext(1);
    expect(await h.sync.flush()).toEqual({ synced: 1, failed: 1, remaining: 1 });
    expect(await h.sync.flush()).toEqual({ synced: 1, failed: 0, remaining: 0 });
    expect(h.published.filter((e) => e.payload.synced === true)).toHaveLength(2);
  });
});
